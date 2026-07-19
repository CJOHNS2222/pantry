import React, { useState } from 'react';
import { User, Household, Member } from '../../types';
import { Users, Mail, Plus, X, Settings, ChefHat } from 'lucide-react';
import { getFunctions, httpsCallable } from "firebase/functions";
import { PremiumFeature } from '../settings/PremiumFeature';
import { Tab } from '../../types/app';
import { serverTimestamp } from 'firebase/firestore';
import { auth } from '../../firebaseConfig';
import DatabaseMonitoringService from '../../services/databaseMonitoringService';
import { removeMemberFromHousehold } from '../../services/householdService';
import { sendHouseholdInvitationEmail } from '../../services/emailService';
import { log } from '../../services/logService';
import { UsageService } from '../../services/usageService';
import { InventoryCacheService } from '../../services/inventoryCacheService';
import { MealPlanCacheService } from '../../services/MealPlanCacheService';
import { RecipesCacheService } from '../../services/recipesCacheService';
import { ShoppingListCacheService } from '../../services/shoppingListCacheService';
import { useIntl } from 'react-intl';
import AnalyticsService from '../../services/analyticsService';

interface HouseholdManagerProps {
  user: User;
  household: Household | null;
  setHousehold: React.Dispatch<React.SetStateAction<Household | null>>;
  onClose: () => void;
  setActiveTab: (tab: Tab) => void;
  addToast: (message: string, type?: 'error' | 'info', ttl?: number, actionLabel?: string, action?: () => void) => void;
}

export const HouseholdManager: React.FC<HouseholdManagerProps> = ({ user, household, setHousehold, onClose, setActiveTab, addToast }) => {
  
  const intl = useIntl();
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [householdName, setHouseholdName] = useState('');
  const [householdMemberLimitExceeded, setHouseholdMemberLimitExceeded] = useState(false);

  const maxMembers = user.subscription?.tier === 'family' ? 5 :
                    user.subscription?.tier === 'premium' ? 3 : 2;

  const checkHouseholdMemberLimit = async () => {
    try {
      log.debug('Checking household member limit', { userId: user.id, householdId: household?.id }, 'Household');
      const canAdd = await UsageService.canAddHouseholdMember(user.id);
      log.debug('Household member limit check result', { canAdd }, 'Household');
      setHouseholdMemberLimitExceeded(!canAdd);
      return canAdd;
    } catch (error) {
      log.error('Error checking household member limit', error, 'Household');
      return false;
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || isInviting) return;

    if (householdMemberLimitExceeded) {
      addToast('You have reached the maximum number of household members for your plan. Please upgrade to add more members.', 'error');
      return;
    }

    setIsInviting(true);
    try {
      const canAdd = await checkHouseholdMemberLimit();
      if (!canAdd) {
        addToast('You have reached the maximum number of household members for your plan. Please upgrade to add more members.', 'error');
        return;
      }
      const functions = getFunctions();
      const inviteMember = httpsCallable(functions, 'inviteMember');
      
      if (!household) {
        addToast('No household selected', 'error');
        return;
      }

      const result = await inviteMember({ email: inviteEmail, householdId: household.id });
      const { newMember } = result.data as { newMember: Member };

      await UsageService.recordHouseholdMemberAdd(user.id);

      await AnalyticsService.trackHouseholdInviteSent(inviteEmail);

      // Try to send email via EmailJS
      await sendHouseholdInvitationEmail({
        to_email: inviteEmail,
        inviter_name: user.profile?.name || user.name || 'A family member',
        household_name: household.name,
        invite_link: window.location.origin,
        app_url: 'https://stock-spoon-website.web.app/index.html'
      }).catch(err => {
        log.error('Failed to send invitation email', err, 'Household');
      });

      await auth.currentUser?.getIdToken(true);

      setInviteEmail('');
      // If the Cloud Function couldn't resolve the email to an existing UID, it stores the email
      // itself as the member ID (pending member). Surface this to the inviter.
      const hasPendingAccount = newMember.id === inviteEmail;
      if (hasPendingAccount) {
        addToast(
          `Invitation sent! No account found for ${inviteEmail} — they will be added automatically once they sign up.`,
          'info'
        );
      } else {
        addToast(`Invitation sent! ${newMember.name || inviteEmail} has been added to your household.`, 'info');
      }
      log.info('Invitation sent', { email: inviteEmail, householdId: household.id, pending: hasPendingAccount }, 'Household');

    } catch (error: unknown) {
      log.error('Error sending invitation', error, 'Household');
      
      const err = error as { message?: string; code?: string };
      let message = 'Failed to send invitation';
      if (err.code === 'functions/permission-denied') {
        message = 'You are not a member of this household';
      } else if (err.code === 'functions/not-found') {
        message = 'Household not found';
      } else if (err.code === 'functions/unauthenticated') {
        message = 'Please log in to send invitations';
      } else if (err.code === 'functions/invalid-argument') {
        message = err.message || 'Invalid invitation data';
      }
      
      addToast(message, 'error');
      
    } finally {
      setIsInviting(false);
    }
  };

  const removeMember = async (id: string) => {
    try {
      if (!household) return;
      await removeMemberFromHousehold(household.id, id, user.id);
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string };
      log.error('Error removing member', { error: err.message, code: err.code }, 'Household');
      
      let message = 'Failed to remove member';
      if (err.code === 'functions/permission-denied') {
        message = 'You do not have permission to remove this member';
      } else if (err.code === 'functions/not-found') {
        message = 'Member or household not found';
      }
      
      addToast(message, 'error');
    }
  };

  const leaveHousehold = async () => {
    try {
      // Copy household data to user's personal collection using cache services
      if (!household) {
        addToast('No household selected', 'error');
        return;
      }
      const householdId = household.id;
      const userId = user.id;

      const inventory = await InventoryCacheService.getCachedInventory(householdId);
      await InventoryCacheService.updateCache(inventory, undefined, userId);

      const mealPlan = await MealPlanCacheService.getCachedMealPlan(householdId);
      await MealPlanCacheService.updateCache(mealPlan, undefined, userId);

      const shoppingList = await ShoppingListCacheService.getCachedShoppingList(householdId);
      await ShoppingListCacheService.setCache(shoppingList, undefined, userId);

      const savedRecipes = await RecipesCacheService.getCachedRecipes(householdId);
      await RecipesCacheService.updateCache(savedRecipes, undefined, userId);

      const leaveHouseholdFunction = httpsCallable(getFunctions(), 'leaveHousehold');
      await leaveHouseholdFunction({ householdId });
      
      await AnalyticsService.trackEvent('household_leave', { householdId });

      const userRef = DatabaseMonitoringService.doc('users', userId);
      await DatabaseMonitoringService.updateDoc(userRef, {
        householdId: null,
        updatedAt: serverTimestamp()
      });

      setHousehold(null);
      onClose();
      
      addToast('You have left the household. Your data has been copied to your personal collections.', 'info');
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string };
      log.error('Error leaving household', { error: err.message, code: err.code }, 'Household');
      
      let message = 'Failed to leave household';
      if (err.code === 'functions/permission-denied') {
        message = 'You do not have permission to leave this household';
      } else if (err.code === 'functions/not-found') {
        message = 'Household not found';
      }
      
      addToast(message, 'error');
    }
  };

  const createHousehold = async () => {
    if (!householdName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const householdsColl = DatabaseMonitoringService.collection('households');
      const newHousehold = {
        name: householdName.trim(),
        memberIds: [user.id],
        members: [{
          id: user.id,
          name: user.profile?.name || user.name,
          email: user.email,
          role: 'admin',
          status: 'active'
        }]
      };

      const createdRef = await DatabaseMonitoringService.addDoc(householdsColl, newHousehold);

      const userRef = DatabaseMonitoringService.doc('users', user.id);
      await DatabaseMonitoringService.updateDoc(userRef, {
        householdId: createdRef.id,
        updatedAt: serverTimestamp()
      });

      // Migrate user data to household using cache services
      const userId = user.id;
      const householdId = createdRef.id;

      const inventory = await InventoryCacheService.getCachedInventory(undefined, userId);
      await InventoryCacheService.updateCache(inventory, householdId, undefined);
      await InventoryCacheService.updateCache([], undefined, userId); // Clear user's cache

      const mealPlan = await MealPlanCacheService.getCachedMealPlan(undefined, userId);
      await MealPlanCacheService.updateCache(mealPlan, householdId, undefined);
      await MealPlanCacheService.updateCache([], undefined, userId); // Clear user's cache

      const shoppingList = await ShoppingListCacheService.getCachedShoppingList(undefined, userId);
      await ShoppingListCacheService.setCache(shoppingList, householdId, undefined);
      await ShoppingListCacheService.setCache([], undefined, userId); // Clear user's cache

      const savedRecipes = await RecipesCacheService.getCachedRecipes(undefined, userId);
      await RecipesCacheService.updateCache(savedRecipes, householdId, undefined);
      await RecipesCacheService.updateCache([], undefined, userId); // Clear user's cache
      
      // Track household creation
      AnalyticsService.trackHouseholdJoin(createdRef.id, 'owner');
      
      log.info('Household created and data migrated successfully', { householdId, userId }, 'Household');
    } catch (error) {
      log.error('Error creating household', error, 'Household');
      addToast('Failed to create household. Please try again.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  if (!household && !user?.householdId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-theme-secondary border border-theme w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="p-4 border-b border-theme flex justify-between items-center bg-theme-primary/30">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[var(--accent-color)]" />
              <h2 className="font-serif font-bold text-theme-primary text-lg">{intl.formatMessage({ id: 'household.create' })}</h2>
            </div>
            <button onClick={onClose} className="text-theme-secondary hover:text-theme-primary" data-testid="household-close">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="p-6 pb-2.5">
            <div className="text-center">
              <Users className="w-16 h-16 text-[var(--accent-color)]/50 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-theme-primary mb-2">{intl.formatMessage({ id: 'household.createYours' })}</h3>
              <p className="text-theme-secondary mb-6">
                Create a household to start sharing your pantry with family members.
              </p>
              
              <div className="mb-4">
                <input
                  type="text"
                  maxLength={50}
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  placeholder="Enter household name"
                  className="w-full bg-theme-primary border border-theme rounded-lg px-4 py-3 text-theme-primary placeholder-theme focus:border-[var(--accent-color)] outline-none"
                  disabled={isCreating}
                  data-testid="household-name-input"
                />
              </div>
              
              <button 
                onClick={createHousehold}
                disabled={!householdName.trim() || isCreating}
                className="bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 disabled:bg-gray-500 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors w-full flex items-center justify-center"
                data-testid="household-create-button"
              >
                {isCreating ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                ) : (
                  <Plus className="w-5 h-5 mr-2" />
                )}
                {isCreating ? 'Creating...' : intl.formatMessage({ id: 'household.create' })}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!household && user?.householdId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-theme-secondary border border-theme w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="p-4 border-b border-theme flex justify-between items-center bg-theme-primary/30">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[var(--accent-color)]" />
              <h2 className="font-serif font-bold text-theme-primary text-lg">{intl.formatMessage({ id: 'household.loading' })}</h2>
            </div>
            <button onClick={onClose} className="text-theme-secondary hover:text-theme-primary" data-testid="household-close">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="p-6 pb-2.5">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-[var(--accent-color)]/30 border-t-[var(--accent-color)] rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-lg font-bold text-theme-primary mb-2">{intl.formatMessage({ id: 'household.settingUp' })}</h3>
              <p className="text-theme-secondary">
                Please wait while we load your household data.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const mainUI = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 pt-[var(--safe-area-inset-top,0px)] pb-[var(--safe-area-inset-bottom,0px)] animate-fade-in">
      <div className="bg-theme-secondary border border-theme w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden flex flex-col max-h-full">
        
        <div className="p-4 border-b border-theme flex justify-between items-center bg-theme-primary/30">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[var(--accent-color)]" />
            <h2 className="font-serif font-bold text-theme-primary text-lg">{household?.name || 'Household'}</h2>
            {household?.members && (
              <span className="text-xs bg-[var(--accent-color)]/20 text-[var(--accent-color)] px-2 py-0.5 rounded-full font-medium">
                {household?.members.length} member{household?.members.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                setActiveTab(Tab.SETTINGS);
                onClose();
                setTimeout(() => {
                  const householdSection = document.querySelector('[data-section="household"]');
                  if (householdSection) {
                    householdSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }, 100);
              }}
              className="text-theme-secondary hover:text-[var(--accent-color)] p-2 transition-colors"
              title="Household Settings"
              data-testid="household-settings-button"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="text-theme-secondary hover:text-theme-primary" data-testid="household-close">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <PremiumFeature
            feature="householdMembers"
            user={user}
            limit={2}
            currentCount={household?.members?.length ?? 0}
            fallbackMessage="Upgrade to Premium plan to add more than 2 household members"
            onUpgrade={() => setActiveTab(Tab.SETTINGS)}
          >
            <div className="bg-theme-primary/40 p-4 rounded-xl border border-theme mb-6">
              <h3 className="text-sm font-bold text-[var(--accent-color)] uppercase mb-3">{intl.formatMessage({ id: 'household.inviteMember' })}</h3>
              <form onSubmit={handleInvite} className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-theme-secondary" />
                  <input 
                    type="email" 
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="w-full bg-theme-primary border border-theme rounded-lg pl-9 pr-4 py-2 text-sm text-theme-primary placeholder-theme focus:border-[var(--accent-color)] outline-none"
                    disabled={isInviting}
                    data-testid="household-invite-input"
                  />
                </div>
                <button 
                  type="submit"
                  className="bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 text-white px-3 py-2 rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center w-12"
                  disabled={isInviting || householdMemberLimitExceeded}
                  data-testid="household-invite-submit"
                >
                  {isInviting ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Plus className="w-5 h-5" />}
                </button>
              </form>
              <p className="text-xs text-theme-secondary mt-2">
                Invited members can view inventory and edit the meal schedule.
              </p>
            </div>
          </PremiumFeature>

          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-bold text-[var(--accent-color)] uppercase">{intl.formatMessage({ id: 'household.groupMembers' })}</h3>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              (household?.members?.length ?? 0) >= maxMembers
                ? 'bg-[var(--accent-color)]/20 text-[var(--accent-color)]'
                : 'bg-theme-primary text-theme-secondary'
            }`}>
              {household?.members?.length ?? 0} / {maxMembers} members
            </span>
          </div>
          <div className="space-y-2">
            {household?.members && Array.isArray(household.members) && household.members.map((member) => {
              return (
                <div key={member.id} className="flex items-center justify-between bg-theme-primary p-3 rounded-lg border border-theme">
                  <div className="flex items-center gap-3 flex-1">
                    <button 
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                        member.email === user.email ? 'bg-[var(--accent-color)] text-white' : 'bg-theme-secondary text-theme-primary hover:bg-theme'
                      } transition-colors cursor-default`}
                    >
                      {member.name.charAt(0).toUpperCase()}
                    </button>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-theme-primary flex items-center gap-2">
                        {member.name && member.name !== 'Unknown' ? member.name : (member.email ? member.email.split('@')[0] : 'Unknown Member')} 
                        {member.email === user.email && <span className="text-[10px] bg-[var(--accent-color)]/20 text-[var(--accent-color)] px-1.5 rounded">YOU</span>}
                      </div>
                      <div className="text-xs text-theme-secondary">{member.role} • {member.status}</div>
                      {(member.dietaryRestrictions?.length || member.allergies?.length || member.specialNeeds) && (
                        <div className="text-xs text-[var(--accent-color)]/80 mt-1 flex items-center gap-1">
                          <ChefHat className="w-3 h-3" />
                          Has dietary preferences
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const currentUser = household?.members && Array.isArray(household.members) ? household.members.find(m => m.email === user.email) : null;
                      return member.email !== user.email && currentUser?.role === 'admin' && (
                        <button 
                          onClick={() => removeMember(member.id)}
                          className="text-theme-secondary hover:text-red-400 p-2"
                          title="Remove member"
                          data-testid={`household-remove-${member.id}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 pb-2.5 bg-theme-primary/30 border-t border-theme">
          {(() => {
            const currentUser = household?.members && Array.isArray(household.members) ? household.members.find(m => m.email === user.email) : null;
            const isAloneAdmin = currentUser?.role === 'admin' && household?.members?.length === 1;
            return (currentUser?.role !== 'admin' || isAloneAdmin) && (
              <div className="mb-3">
                <button
                  onClick={leaveHousehold}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                  data-testid="household-leave-button"
                >
                  Leave Household
                </button>
              </div>
            );
          })()}
          <p className="text-xs text-theme-secondary text-center">Changes are saved to your family group instantly.</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {mainUI}
    </>
  );
};
