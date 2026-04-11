import React, { useState } from 'react';
import { User, Household, Member } from '../types';
import { Users, Mail, Plus, X, Settings, ChefHat, Heart, AlertTriangle } from 'lucide-react';
import { getFunctions, httpsCallable } from "firebase/functions";
import { PremiumFeature } from './PremiumFeature';
import { Tab } from '../types/app';
import { serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import DatabaseMonitoringService from '../services/databaseMonitoringService';
import { removeMemberFromHousehold } from '../services/householdService';
import { log } from '../services/logService';
import { UsageService } from '../services/usageService';
import { InventoryCacheService } from '../services/inventoryCacheService';
import { MealPlanCacheService } from '../services/MealPlanCacheService';
import { RecipesCacheService } from '../services/recipesCacheService';
import { ShoppingListCacheService } from '../services/shoppingListCacheService';
import { useIntl } from 'react-intl';

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

      await auth.currentUser?.getIdToken(true);

      setInviteEmail('');
      log.info('Invitation sent and member added as pending', { email: inviteEmail, householdId: household.id }, 'Household');

    } catch (error: any) {
      log.error('Error sending invitation', error, 'Household');
      
      let message = 'Failed to send invitation';
      if (error.code === 'functions/permission-denied') {
        message = 'You are not a member of this household';
      } else if (error.code === 'functions/not-found') {
        message = 'Household not found';
      } else if (error.code === 'functions/unauthenticated') {
        message = 'Please log in to send invitations';
      } else if (error.code === 'functions/invalid-argument') {
        message = error.message || 'Invalid invitation data';
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
    } catch (error: any) {
      log.error('Error removing member', { error: error?.message, code: error?.code }, 'Household');
      
      let message = 'Failed to remove member';
      if (error.code === 'functions/permission-denied') {
        message = 'You do not have permission to remove this member';
      } else if (error.code === 'functions/not-found') {
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
      
      const userRef = DatabaseMonitoringService.doc('users', userId);
      await DatabaseMonitoringService.updateDoc(userRef, {
        householdId: null,
        updatedAt: serverTimestamp()
      });

      setHousehold(null);
      onClose();
      
      addToast('You have left the household. Your data has been copied to your personal collections.', 'info');
    } catch (error: any) {
      log.error('Error leaving household', { error: error?.message, code: error?.code }, 'Household');
      
      let message = 'Failed to leave household';
      if (error.code === 'functions/permission-denied') {
        message = 'You do not have permission to leave this household';
      } else if (error.code === 'functions/not-found') {
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
          name: user?.profile?.name || user.name,
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
        <div className="bg-[#3F1016] border border-amber-500/30 w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="p-4 border-b border-red-900/50 flex justify-between items-center bg-[#2A0A10]">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              <h2 className="font-serif font-bold text-amber-50 text-lg">{intl.formatMessage({ id: 'household.create' })}</h2>
            </div>
            <button onClick={onClose} className="text-red-200/50 hover:text-white" data-testid="household-close">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="p-6 pb-2.5">
            <div className="text-center">
              <Users className="w-16 h-16 text-amber-500/50 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">{intl.formatMessage({ id: 'household.createYours' })}</h3>
              <p className="text-red-200/70 mb-6">
                Create a household to start sharing your pantry with family members.
              </p>
              
              <div className="mb-4">
                <input
                  type="text"
                  maxLength={50}
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  placeholder="Enter household name"
                  className="w-full bg-[#2A0A10] border border-red-900/50 rounded-lg px-4 py-3 text-white placeholder-red-200/50 focus:border-amber-500 outline-none"
                  disabled={isCreating}
                  data-testid="household-name-input"
                />
              </div>
              
              <button 
                onClick={createHousehold}
                disabled={!householdName.trim() || isCreating}
                className="bg-amber-600 hover:bg-amber-500 disabled:bg-gray-500 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors w-full flex items-center justify-center"
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
        <div className="bg-[#3F1016] border border-amber-500/30 w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="p-4 border-b border-red-900/50 flex justify-between items-center bg-[#2A0A10]">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              <h2 className="font-serif font-bold text-amber-50 text-lg">{intl.formatMessage({ id: 'household.loading' })}</h2>
            </div>
            <button onClick={onClose} className="text-red-200/50 hover:text-white" data-testid="household-close">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="p-6 pb-2.5">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-lg font-bold text-white mb-2">{intl.formatMessage({ id: 'household.settingUp' })}</h3>
              <p className="text-red-200/70">
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
      <div className="bg-[#3F1016] border border-amber-500/30 w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden flex flex-col max-h-full">
        
        <div className="p-4 border-b border-red-900/50 flex justify-between items-center bg-[#2A0A10]">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            <h2 className="font-serif font-bold text-amber-50 text-lg">{household?.name || 'Household'}</h2>
            {household?.members && (
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-medium">
                {household.members.length} member{household.members.length !== 1 ? 's' : ''}
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
              className="text-red-200/50 hover:text-amber-500 p-2 transition-colors"
              title="Household Settings"
              data-testid="household-settings-button"
            >
              <Settings className="w-5 h-5" />
            </button>

            <button onClick={onClose} className="text-red-200/50 hover:text-white" data-testid="household-close">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <PremiumFeature
            feature="householdMembers"
            user={user}
            limit={3}
            currentCount={household?.members?.length ?? 0}
            fallbackMessage="Upgrade to Family plan to add more than 3 household members"
            onUpgrade={() => setActiveTab(Tab.SETTINGS)}
          >
            <div className="bg-[#2A0A10]/50 p-4 rounded-xl border border-red-900/30 mb-6">
                  <h3 className="text-sm font-bold text-amber-500 uppercase mb-3">{intl.formatMessage({ id: 'household.inviteMember' })}</h3>
                  <form onSubmit={handleInvite} className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-red-900/50" />
                      <input 
                        type="email" 
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="Enter email address"
                        className="w-full bg-[#2A0A10] border border-red-900/50 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-red-200/50 focus:border-amber-500 outline-none"
                        disabled={isInviting}
                        data-testid="household-invite-input"
                      />
                    </div>
                    <button 
                      type="submit"
                      className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-2 rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center w-12"
                      disabled={isInviting || householdMemberLimitExceeded}
                      data-testid="household-invite-submit"
                    >
                      {isInviting ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Plus className="w-5 h-5" />}
                    </button>
                  </form>
                  <p className="text-xs text-red-200/40 mt-2">
                    Invited members can view inventory and edit the meal schedule.
                  </p>
                </div>
              </PremiumFeature>

          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-bold text-amber-500 uppercase">{intl.formatMessage({ id: 'household.groupMembers' })}</h3>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              (household?.members?.length ?? 0) >= 3
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-red-900/30 text-red-200/60'
            }`}>
              {household?.members?.length ?? 0} / 3 members
            </span>
          </div>
          <div className="space-y-2">
            {household?.members && Array.isArray(household.members) && household.members.map((member) => {
              const currentUser = household?.members && Array.isArray(household.members) ? household.members.find(m => m.email === user.email) : null;
              return (
              <div key={member.id} className="flex items-center justify-between bg-[#2A0A10] p-3 rounded-lg border border-red-900/30">
                <div className="flex items-center gap-3 flex-1">
                  <button 
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                      member.email === user.email ? 'bg-amber-500 text-[#2A0A10]' : 'bg-red-900/50 text-red-200 hover:bg-red-800/50'
                    } transition-colors cursor-default`}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </button>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white flex items-center gap-2">
                      {member.name && member.name !== 'Unknown' ? member.name : (member.email ? member.email.split('@')[0] : 'Unknown Member')} 
                      {member.email === user.email && <span className="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 rounded">YOU</span>}
                    </div>
                    <div className="text-xs text-red-200/50">{member.role} • {member.status}</div>
                    {(member.dietaryRestrictions?.length || member.allergies?.length || member.specialNeeds) && (
                      <div className="text-xs text-amber-400/70 mt-1 flex items-center gap-1">
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
                        className="text-red-900/50 hover:text-red-400 p-2"
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

        <div className="p-4 pb-2.5 bg-[#2A0A10] border-t border-red-900/50">
          <div className="mb-3">
            <button
              onClick={leaveHousehold}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              data-testid="household-leave-button"
            >
              Leave Household
            </button>
          </div>
          <p className="text-xs text-red-200/30 text-center">Changes are saved to your family group instantly.</p>
        </div>
      </div>
    </div>
  );

  // Main Household Modal (when not showing member preferences)
  if (!household) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-[#3F1016] border border-amber-500/30 w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="p-4 border-b border-red-900/50 flex justify-between items-center bg-[#2A0A10]">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              <h2 className="font-serif font-bold text-amber-50 text-lg">{intl.formatMessage({ id: 'household.create' })}</h2>
            </div>
            <button onClick={onClose} className="text-red-200/50 hover:text-white" data-testid="household-close">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="p-6 pb-2.5">
            <div className="text-center">
              <Users className="w-16 h-16 text-amber-500/50 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">{intl.formatMessage({ id: 'household.createYours' })}</h3>
              <p className="text-red-200/70 mb-6">
                Create a household to start sharing your pantry with family members.
              </p>
              
              <div className="mb-4">
                <input
                  type="text"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  placeholder="Household name (e.g., Smith Family)"
                  className="w-full bg-[#2A0A10] border border-red-900/50 rounded-lg px-4 py-3 text-white placeholder-red-200/50 focus:border-amber-500 outline-none"
                />
              </div>
              
              <button
                onClick={createHousehold}
                disabled={!householdName.trim() || isCreating}
                className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-gray-500 text-white py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center"
              >
                {isCreating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  intl.formatMessage({ id: 'household.create' })
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Household Management Modal (when household exists)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[#3F1016] border border-amber-500/30 w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden">
        <div className="p-4 border-b border-red-900/50 flex justify-between items-center bg-[#2A0A10]">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            <h2 className="font-serif font-bold text-amber-50 text-lg">{household.name}</h2>
          </div>
          <button onClick={onClose} className="text-red-200/50 hover:text-white" data-testid="household-close">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <PremiumFeature
            feature="householdMembers"
            user={user}
              limit={3}
              currentCount={household.members?.length || 0}
              fallbackMessage="Upgrade to Family plan to add more than 3 household members"
              onUpgrade={() => setActiveTab(Tab.SETTINGS)}
              >
                <div className="bg-[#2A0A10]/50 p-4 rounded-xl border border-red-900/30 mb-6">
                  <h3 className="text-sm font-bold text-amber-500 uppercase mb-3">{intl.formatMessage({ id: 'household.inviteMember' })}</h3>
                  <form onSubmit={handleInvite} className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-red-900/50" />
                      <input 
                        type="email" 
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="Enter email address"
                        className="w-full bg-[#2A0A10] border border-red-900/50 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-red-200/50 focus:border-amber-500 outline-none"
                        disabled={isInviting}
                      />
                    </div>
                    <button 
                      type="submit"
                      className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-2 rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center w-12"
                      disabled={isInviting || householdMemberLimitExceeded}
                    >
                      {isInviting ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Plus className="w-5 h-5" />}
                    </button>
                  </form>
                  <p className="text-xs text-red-200/40 mt-2">
                    Invited members can view inventory and edit the meal schedule.
                  </p>
                </div>
              </PremiumFeature>

          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-bold text-amber-500 uppercase">{intl.formatMessage({ id: 'household.groupMembers' })}</h3>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              (household.members?.length ?? 0) >= 3
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-red-900/30 text-red-200/60'
            }`}>
              {household.members?.length ?? 0} / 3 members
            </span>
          </div>
          <div className="space-y-2">
            {household.members && Array.isArray(household.members) && household.members.map((member) => {
              const currentUser = household.members && Array.isArray(household.members) ? household.members.find(m => m.email === user.email) : null;
              return (
              <div key={member.id} className="flex items-center justify-between bg-[#2A0A10] p-3 rounded-lg border border-red-900/30">
                <div className="flex items-center gap-3 flex-1">
                  <button 
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                      member.email === user.email ? "bg-amber-500 text-[#2A0A10]" : "bg-red-900/50 text-red-200 hover:bg-red-800/50"
                    } transition-colors cursor-default`}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </button>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white flex items-center gap-2">
                      {member.name} 
                      {member.email === user.email && <span className="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 rounded">YOU</span>}
                    </div>
                    <div className="text-xs text-red-200/50">{member.role}  {member.status}</div>
                    {(member.dietaryRestrictions?.length || member.allergies?.length || member.specialNeeds) && (
                      <div className="text-xs text-amber-400/70 mt-1 flex items-center gap-1">
                        <ChefHat className="w-3 h-3" />
                        Has dietary preferences
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const currentUser = household.members && Array.isArray(household.members) ? household.members.find(m => m.email === user.email) : null;
                    return member.email !== user.email && currentUser?.role === "admin" && (
                      <button 
                        onClick={() => removeMember(member.id)}
                        className="text-red-900/50 hover:text-red-400 p-2"
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

        <div className="p-4 pb-2.5 bg-[#2A0A10] border-t border-red-900/50">
          {(() => {
            const currentUser = household.members && Array.isArray(household.members) ? household.members.find(m => m.email === user.email) : null;
            return currentUser?.role !== "admin" && (
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
          <p className="text-xs text-red-200/30 text-center">Changes are saved to your family group instantly.</p>
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
