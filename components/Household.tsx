import React, { useState } from 'react';
import { User, Household, Member } from '../types';
import { Users, Mail, Plus, X, Settings, ChefHat, Heart, AlertTriangle } from 'lucide-react';
import { getFunctions, httpsCallable } from "firebase/functions";
import { PremiumFeature } from './PremiumFeature';
import { Tab } from '../types/app';
import { addDoc, collection, doc, setDoc, updateDoc, serverTimestamp, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { removeMemberFromHousehold } from '../services/householdService';
import { UsageService } from '../services/usageService';

interface HouseholdManagerProps {
  user: User;
  household: Household | null;
  setHousehold: React.Dispatch<React.SetStateAction<Household | null>>;
  onClose: () => void;
  setActiveTab: (tab: Tab) => void;
  addToast: (message: string, type?: 'error' | 'info', ttl?: number, actionLabel?: string, action?: () => void) => void;
}

export const HouseholdManager: React.FC<HouseholdManagerProps> = ({ user, household, setHousehold, onClose, setActiveTab, addToast }) => {
  
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [householdName, setHouseholdName] = useState('');
  const [householdMemberLimitExceeded, setHouseholdMemberLimitExceeded] = useState(false);
  const [showMemberPreferences, setShowMemberPreferences] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberPreferences, setMemberPreferences] = useState<Partial<Member>>({});

  const checkHouseholdMemberLimit = async () => {
    try {
      console.log('checkHouseholdMemberLimit - Checking for user:', user.id, 'household:', household?.id);
      const canAdd = await UsageService.canAddHouseholdMember(user.id);
      console.log('checkHouseholdMemberLimit - Result:', canAdd);
      setHouseholdMemberLimitExceeded(!canAdd);
      return canAdd;
    } catch (error) {
      console.error('Error checking household member limit:', error);
      return false;
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || isInviting) return;

    // Check if we've already determined the limit is exceeded
    if (householdMemberLimitExceeded) {
      alert('You have reached the maximum number of household members for your plan. Please upgrade to add more members.');
      return;
    }

    setIsInviting(true);
    try {
      // Check household member limit (and update state)
      const canAdd = await checkHouseholdMemberLimit();
      if (!canAdd) {
        alert('You have reached the maximum number of household members for your plan. Please upgrade to add more members.');
        return;
      }
      console.log('Inviting to household:', household);
      console.log('Household members:', household.members);
      console.log('User ID:', user.id);
      const functions = getFunctions();
      const inviteMember = httpsCallable(functions, 'inviteMember');
      
      // The cloud function returns the new member data upon success
      const result = await inviteMember({ email: inviteEmail, householdId: household.id });
      const { newMember } = result.data as { newMember: Member };

      // Don't update local state here - the Firestore listener will handle it when the document updates
      // setHousehold(prev => ({
      //   ...prev,
      //   members: [...prev.members, newMember]
      // }));

      // Record the household member addition for usage tracking
      await UsageService.recordHouseholdMemberAdd(user.id);

      // Refresh the ID token to get updated custom claims
      await auth.currentUser?.getIdToken(true);

      setInviteEmail('');
      console.log("Invitation sent and member added as pending!");

    } catch (error: any) {
      console.error("Error sending invitation:", error);
      
      // Show user-friendly error message
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
      
      // Fallback: try HTTP endpoint with ID token (handles CORS/dev calls)
      try {
        const { auth } = await import('../firebaseConfig');
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('No auth token available');

        const resp = await fetch(`https://us-central1-ornate-compass-478504-e1.cloudfunctions.net/inviteMemberHttp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ email: inviteEmail, householdId: household.id })
        });

        if (!resp.ok) throw new Error(`HTTP invite failed: ${resp.status}`);
        const json = await resp.json();
        if (json?.newMember) {
          // Don't update local state here - the Firestore listener will handle it
          // setHousehold(prev => ({ ...prev, members: [...prev.members, json.newMember] }));
          
          // Record the household member addition for usage tracking
          await UsageService.recordHouseholdMemberAdd(user.id);
          
          // Refresh the ID token to get updated custom claims
          await auth.currentUser?.getIdToken(true);
          
          setInviteEmail('');
          console.log('Invitation sent via HTTP fallback');
        }
      } catch (err) {
        console.error('Fallback HTTP invite error:', err);
        addToast('Failed to send invitation. Please try again.', 'error');
      }
    } finally {
      setIsInviting(false);
    }
  };

  const removeMember = async (id: string) => {
    if (!confirm(`Are you sure you want to remove this member from the household?`)) {
      return;
    }

    try {
      await removeMemberFromHousehold(household.id, id, user.id);
      
      // Don't update local state here - the Firestore listener will handle it when the document updates
      // setHousehold(prev => ({
      //   ...prev,
      //   members: prev.members.filter(m => m.id !== id),
      //   memberIds: prev.memberIds?.filter(mid => mid !== id)
      // }));

      // If this was the last member, household will be deleted by the backend
      // Check if household still exists
      // const updatedHousehold = { ...household };
      // updatedHousehold.members = updatedHousehold.members.filter(m => m.id !== id);
      // if (updatedHousehold.members.length === 1) {
      //   // Household was deleted
      //   setHousehold(null);
      //   onClose();
      // }

    } catch (error: any) {
      console.error('Error removing member:', error);
      
      // Show user-friendly error message
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
    if (!confirm(`Are you sure you want to leave this household? Your inventory and meal plans will be copied to your personal collections.`)) {
      return;
    }

    try {
      // Copy household inventory back to user's personal collection
      try {
        const householdInventoryRef = collection(db, 'households', household.id, 'inventory');
        const householdInventorySnapshot = await getDocs(householdInventoryRef);
        
        if (!householdInventorySnapshot.empty) {
          const batch = writeBatch(db);
          const userInventoryRef = collection(db, 'users', user.id, 'inventory');
          
          householdInventorySnapshot.docs.forEach((docItem) => {
            const itemData = docItem.data();
            const newItemRef = doc(userInventoryRef, docItem.id);
            batch.set(newItemRef, itemData);
          });
          
          await batch.commit();
          console.log(`Copied ${householdInventorySnapshot.size} inventory items to user collection`);
        }
      } catch (inventoryError) {
        console.error('Error copying inventory:', inventoryError);
        // Continue with leaving household even if inventory copy fails
      }

      // Copy household meal plans back to user's personal collection
      try {
        const householdMealPlanRef = collection(db, 'households', household.id, 'mealPlan');
        const householdMealPlanSnapshot = await getDocs(householdMealPlanRef);
        
        if (!householdMealPlanSnapshot.empty) {
          const batch = writeBatch(db);
          const userMealPlanRef = collection(db, 'users', user.id, 'mealPlan');
          
          householdMealPlanSnapshot.docs.forEach((docItem) => {
            const planData = docItem.data();
            const newPlanRef = doc(userMealPlanRef, docItem.id);
            batch.set(newPlanRef, planData);
          });
          
          await batch.commit();
          console.log(`Copied ${householdMealPlanSnapshot.size} meal plans to user collection`);
        }
      } catch (mealPlanError) {
        console.error('Error copying meal plans:', mealPlanError);
        // Continue with leaving household even if meal plan copy fails
      }

      // Copy household shopping lists back to user's personal collection
      try {
        const householdShoppingListRef = collection(db, 'households', household.id, 'shoppingList');
        const householdShoppingListSnapshot = await getDocs(householdShoppingListRef);
        
        if (!householdShoppingListSnapshot.empty) {
          const batch = writeBatch(db);
          const userShoppingListRef = collection(db, 'users', user.id, 'shoppingList');
          
          householdShoppingListSnapshot.docs.forEach((docItem) => {
            const listData = docItem.data();
            const newListRef = doc(userShoppingListRef, docItem.id);
            batch.set(newListRef, listData);
          });
          
          await batch.commit();
          console.log(`Copied ${householdShoppingListSnapshot.size} shopping list items to user collection`);
        }
      } catch (shoppingListError) {
        console.error('Error copying shopping list:', shoppingListError);
        // Continue with leaving household even if shopping list copy fails
      }

      // Copy household saved recipes back to user's personal collection
      try {
        const householdSavedRecipesRef = collection(db, 'households', household.id, 'savedRecipes');
        const householdSavedRecipesSnapshot = await getDocs(householdSavedRecipesRef);
        
        if (!householdSavedRecipesSnapshot.empty) {
          const batch = writeBatch(db);
          const userSavedRecipesRef = collection(db, 'users', user.id, 'savedRecipes');
          
          householdSavedRecipesSnapshot.docs.forEach((docItem) => {
            const recipeData = docItem.data();
            const newRecipeRef = doc(userSavedRecipesRef, docItem.id);
            batch.set(newRecipeRef, recipeData);
          });
          
          await batch.commit();
          console.log(`Copied ${householdSavedRecipesSnapshot.size} saved recipes to user collection`);
        }
      } catch (savedRecipesError) {
        console.error('Error copying saved recipes:', savedRecipesError);
        // Continue with leaving household even if saved recipes copy fails
      }

      // Remove user from household using Cloud Function (admin privileges)
      const leaveHouseholdFunction = httpsCallable(getFunctions(), 'leaveHousehold');
      await leaveHouseholdFunction({ householdId: household.id });
      
      // Update user's householdId to null
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        householdId: null,
        updatedAt: serverTimestamp()
      });

      // Close the household modal and clear household state
      setHousehold(null);
      onClose();
      
      addToast('You have left the household. Your data has been copied to your personal collections.', 'info');
    } catch (error: any) {
      console.error('Error leaving household:', error);
      
      // Show user-friendly error message
      let message = 'Failed to leave household';
      if (error.code === 'functions/permission-denied') {
        message = 'You do not have permission to leave this household';
      } else if (error.code === 'functions/not-found') {
        message = 'Household not found';
      }
      
      addToast(message, 'error');
    }
  };

  const openMemberPreferences = (member: Member) => {
    setSelectedMember(member);
    setMemberPreferences({
      dietaryRestrictions: member.dietaryRestrictions || [],
      allergies: member.allergies || [],
      dietGoal: member.dietGoal,
      favoriteCuisines: member.favoriteCuisines || [],
      specialNeeds: member.specialNeeds || '',
      preferredProteins: member.preferredProteins || [],
      dislikedIngredients: member.dislikedIngredients || [],
    });
    setShowMemberPreferences(true);
  };

  const saveMemberPreferences = async () => {
    if (!selectedMember || !household) return;

    try {
      const memberIndex = household.members.findIndex(m => m.id === selectedMember.id);
      if (memberIndex === -1) return;

      const updatedMember = { ...household.members[memberIndex], ...memberPreferences };
      const updatedMembers = [...household.members];
      updatedMembers[memberIndex] = updatedMember;

      await updateDoc(doc(db, 'households', household.id), {
        members: updatedMembers,
        updatedAt: serverTimestamp()
      });

      setShowMemberPreferences(false);
      setSelectedMember(null);
      addToast('Member preferences updated successfully', 'info');
    } catch (error) {
      console.error('Error updating member preferences:', error);
      addToast('Failed to update member preferences', 'error');
    }
  };

  const createHousehold = async () => {
    if (!householdName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const householdRef = doc(collection(db, 'households'));
      const newHousehold = {
        name: householdName.trim(),
        memberIds: [user.id],
        members: [{
          id: user.id,
          name: user.name,
          email: user.email,
          role: 'admin',
          status: 'Active'
        }]
      };

      console.log('Creating household with data:', newHousehold);
      await setDoc(householdRef, newHousehold);

      // Verify the document was created correctly
      const createdDoc = await getDoc(householdRef);
      const createdData = createdDoc.data();
      console.log('Created household document data:', createdData);
      
      // Update the user's document with the householdId
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        householdId: householdRef.id,
        updatedAt: serverTimestamp()
      });

      // Migrate existing user inventory to household inventory
      try {
        const userInventoryRef = collection(db, 'users', user.id, 'inventory');
        const userInventorySnapshot = await getDocs(userInventoryRef);
        
        if (!userInventorySnapshot.empty) {
          const batch = writeBatch(db);
          const householdInventoryRef = collection(db, 'households', householdRef.id, 'inventory');
          
          userInventorySnapshot.docs.forEach((docItem) => {
            const itemData = docItem.data();
            const newItemRef = doc(householdInventoryRef, docItem.id);
            batch.set(newItemRef, itemData);
            batch.delete(docItem.ref);
          });
          
          await batch.commit();
          console.log(`Migrated ${userInventorySnapshot.size} inventory items to household`);
        }
      } catch (migrationError) {
        console.error('Error migrating inventory:', migrationError);
        // Don't fail the household creation if inventory migration fails
      }

      // Migrate existing user meal plans to household meal plans
      try {
        const userMealPlanRef = collection(db, 'users', user.id, 'mealPlan');
        const userMealPlanSnapshot = await getDocs(userMealPlanRef);
        
        if (!userMealPlanSnapshot.empty) {
          const batch = writeBatch(db);
          const householdMealPlanRef = collection(db, 'households', householdRef.id, 'mealPlan');
          
          userMealPlanSnapshot.docs.forEach((docItem) => {
            const planData = docItem.data();
            const newPlanRef = doc(householdMealPlanRef, docItem.id);
            batch.set(newPlanRef, planData);
            batch.delete(docItem.ref);
          });
          
          await batch.commit();
          console.log(`Migrated ${userMealPlanSnapshot.size} meal plans to household`);
        }
      } catch (migrationError) {
        console.error('Error migrating meal plans:', migrationError);
        // Don't fail the household creation if meal plan migration fails
      }

      // Migrate existing user shopping lists to household shopping lists
      try {
        const userShoppingListRef = collection(db, 'users', user.id, 'shoppingList');
        const userShoppingListSnapshot = await getDocs(userShoppingListRef);
        
        if (!userShoppingListSnapshot.empty) {
          const batch = writeBatch(db);
          const householdShoppingListRef = collection(db, 'households', householdRef.id, 'shoppingList');
          
          userShoppingListSnapshot.docs.forEach((docItem) => {
            const listData = docItem.data();
            const newListRef = doc(householdShoppingListRef, docItem.id);
            batch.set(newListRef, listData);
            batch.delete(docItem.ref);
          });
          
          await batch.commit();
          console.log(`Migrated ${userShoppingListSnapshot.size} shopping list items to household`);
        }
      } catch (migrationError) {
        console.error('Error migrating shopping list:', migrationError);
        // Don't fail the household creation if shopping list migration fails
      }

      // Migrate existing user saved recipes to household saved recipes
      try {
        const userSavedRecipesRef = collection(db, 'users', user.id, 'savedRecipes');
        const userSavedRecipesSnapshot = await getDocs(userSavedRecipesRef);
        
        if (!userSavedRecipesSnapshot.empty) {
          const batch = writeBatch(db);
          const householdSavedRecipesRef = collection(db, 'households', householdRef.id, 'savedRecipes');
          
          userSavedRecipesSnapshot.docs.forEach((docItem) => {
            const recipeData = docItem.data();
            const newRecipeRef = doc(householdSavedRecipesRef, docItem.id);
            batch.set(newRecipeRef, recipeData);
            batch.delete(docItem.ref);
          });
          
          await batch.commit();
          console.log(`Migrated ${userSavedRecipesSnapshot.size} saved recipes to household`);
        }
      } catch (migrationError) {
        console.error('Error migrating saved recipes:', migrationError);
        // Don't fail the household creation if saved recipes migration fails
      }
      
      // Don't set household locally - the Firestore listener will handle it when user.householdId is updated
      // const householdWithId = { ...newHousehold, id: householdRef.id };
      // console.log('Setting household locally:', householdWithId);
      // setHousehold(householdWithId);
      // localStorage.setItem('household', JSON.stringify(householdWithId));
      
      console.log('Household created successfully');
    } catch (error) {
      console.error('Error creating household:', error);
      alert('Failed to create household. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // Render create form if no household exists and user doesn't have householdId
  // If user has householdId but household is null, show loading state
  if (!household && !user?.householdId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-[#3F1016] border border-amber-500/30 w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="p-4 border-b border-red-900/50 flex justify-between items-center bg-[#2A0A10]">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              <h2 className="font-serif font-bold text-amber-50 text-lg">Create Household</h2>
            </div>
            <button onClick={onClose} className="text-red-200/50 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="p-6 pb-2.5">
            <div className="text-center">
              <Users className="w-16 h-16 text-amber-500/50 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Create Your Household</h3>
              <p className="text-red-200/70 mb-6">
                Create a household to start sharing your pantry with family members.
              </p>
              
              <div className="mb-4">
                <input
                  type="text"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  placeholder="Enter household name"
                  className="w-full bg-[#2A0A10] border border-red-900/50 rounded-lg px-4 py-3 text-white placeholder-red-200/50 focus:border-amber-500 outline-none"
                  disabled={isCreating}
                />
              </div>
              
              <button 
                onClick={createHousehold}
                disabled={!householdName.trim() || isCreating}
                className="bg-amber-600 hover:bg-amber-500 disabled:bg-gray-500 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors w-full flex items-center justify-center"
              >
                {isCreating ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                ) : (
                  <Plus className="w-5 h-5 mr-2" />
                )}
                {isCreating ? 'Creating...' : 'Create Household'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state if user has householdId but household data hasn't loaded yet
  if (!household && user?.householdId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-[#3F1016] border border-amber-500/30 w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="p-4 border-b border-red-900/50 flex justify-between items-center bg-[#2A0A10]">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              <h2 className="font-serif font-bold text-amber-50 text-lg">Loading Household</h2>
            </div>
            <button onClick={onClose} className="text-red-200/50 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="p-6 pb-2.5">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-lg font-bold text-white mb-2">Setting up your household...</h3>
              <p className="text-red-200/70">
                Please wait while we load your household data.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[#3F1016] border border-amber-500/30 w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]">
        
        <div className="p-4 border-b border-red-900/50 flex justify-between items-center bg-[#2A0A10]">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            <h2 className="font-serif font-bold text-amber-50 text-lg">{household.name}</h2>
          </div>
          <button onClick={onClose} className="text-red-200/50 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Debug: Show user info */}
          <div className="bg-red-900/20 p-2 mb-4 text-xs text-red-200">
            User: {user.email} | Household: {household.name} | Members: {household.members?.length || 0}
            {household.members && Array.isArray(household.members) && household.members.find(m => m.email === user.email) && (
              <> | Role: {household.members.find(m => m.email === user.email)?.role}</>
            )}
            <br />
            Member emails: {household.members && Array.isArray(household.members) ? household.members.map(m => m.email).join(', ') : 'none'}
            <br />
            User in members: {household.members && Array.isArray(household.members) ? (household.members.some(m => m.email === user.email) ? 'YES' : 'NO') : 'N/A'}
            <br />
            Invite button visible: {(() => {
              const currentUser = household.members && Array.isArray(household.members) ? household.members.find(m => m.email === user.email) : null;
              return currentUser?.role === 'admin' ? 'YES (user is admin)' : `NO (${currentUser ? `user role: ${currentUser.role}` : 'user not found in members'})`;
            })()}
          </div>

          {/* Temporarily force invite form to show for testing */}
          {true && (
            <PremiumFeature
              feature="householdMembers"
              user={user}
              limit={3}
              currentCount={household.members?.length || 0}
              fallbackMessage="Upgrade to Family plan to add more than 3 household members"
              onUpgrade={() => setActiveTab(Tab.SETTINGS)}
              >
                <div className="bg-[#2A0A10]/50 p-4 rounded-xl border border-red-900/30 mb-6">
                  <h3 className="text-sm font-bold text-amber-500 uppercase mb-3">Invite Family Member</h3>
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
          )}

          <h3 className="text-sm font-bold text-amber-500 uppercase mb-3 px-1">Group Members</h3>
          <div className="space-y-2">
            {household.members && Array.isArray(household.members) && household.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between bg-[#2A0A10] p-3 rounded-lg border border-red-900/30">
                <div className="flex items-center gap-3 flex-1">
                  <button 
                    onClick={() => {
                      const currentUser = household.members && Array.isArray(household.members) ? household.members.find(m => m.email === user.email) : null;
                      if (currentUser?.role === 'admin') {
                        openMemberPreferences(member);
                      }
                    }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                      member.email === user.email ? 'bg-amber-500 text-[#2A0A10]' : 'bg-red-900/50 text-red-200 hover:bg-red-800/50'
                    } transition-colors`}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </button>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white flex items-center gap-2">
                      {member.name} 
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
                    const currentUser = household.members && Array.isArray(household.members) ? household.members.find(m => m.email === user.email) : null;
                    return currentUser?.role === 'admin' && (
                      <button 
                        onClick={() => openMemberPreferences(member)}
                        className="text-red-900/50 hover:text-amber-500 p-2 transition-colors"
                        title="Edit member preferences"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    );
                  })()}
                  {(() => {
                    const currentUser = household.members && Array.isArray(household.members) ? household.members.find(m => m.email === user.email) : null;
                    return member.email !== user.email && currentUser?.role === 'admin' && (
                      <button 
                        onClick={() => removeMember(member.id)}
                        className="text-red-900/50 hover:text-red-400 p-2"
                        title="Remove member"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 pb-2.5 bg-[#2A0A10] border-t border-red-900/50">
          {(() => {
            const currentUser = household.members && Array.isArray(household.members) ? household.members.find(m => m.email === user.email) : null;
            return currentUser?.role !== 'admin' && (
              <div className="mb-3">
                <button
                  onClick={leaveHousehold}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
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

  // Member Preferences Modal
  if (showMemberPreferences && selectedMember) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-[#3F1016] border border-amber-500/30 w-full max-w-lg rounded-2xl shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto">
          <div className="p-4 border-b border-red-900/50 flex justify-between items-center bg-[#2A0A10] sticky top-0">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-amber-500" />
              <h2 className="font-serif font-bold text-amber-50 text-lg">{selectedMember.name}'s Preferences</h2>
            </div>
            <button onClick={() => setShowMemberPreferences(false)} className="text-red-200/50 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Dietary Restrictions */}
            <div>
              <label className="block text-sm font-medium text-amber-500 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Dietary Restrictions
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Paleo', 'Low-Carb', 'Halal', 'Kosher'].map((restriction) => (
                  <label key={restriction} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={memberPreferences.dietaryRestrictions?.includes(restriction) || false}
                      onChange={(e) => {
                        const current = memberPreferences.dietaryRestrictions || [];
                        if (e.target.checked) {
                          setMemberPreferences(prev => ({
                            ...prev,
                            dietaryRestrictions: [...current, restriction]
                          }));
                        } else {
                          setMemberPreferences(prev => ({
                            ...prev,
                            dietaryRestrictions: current.filter(r => r !== restriction)
                          }));
                        }
                      }}
                      className="rounded border-red-900/50 bg-[#2A0A10] text-amber-500 focus:border-amber-500"
                    />
                    {restriction}
                  </label>
                ))}
              </div>
            </div>

            {/* Allergies */}
            <div>
              <label className="block text-sm font-medium text-amber-500 mb-2">Allergies</label>
              <div className="grid grid-cols-2 gap-2">
                {['Peanuts', 'Tree Nuts', 'Dairy', 'Eggs', 'Soy', 'Wheat', 'Fish', 'Shellfish', 'Sesame', 'Mustard'].map((allergy) => (
                  <label key={allergy} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={memberPreferences.allergies?.includes(allergy) || false}
                      onChange={(e) => {
                        const current = memberPreferences.allergies || [];
                        if (e.target.checked) {
                          setMemberPreferences(prev => ({
                            ...prev,
                            allergies: [...current, allergy]
                          }));
                        } else {
                          setMemberPreferences(prev => ({
                            ...prev,
                            allergies: current.filter(a => a !== allergy)
                          }));
                        }
                      }}
                      className="rounded border-red-900/50 bg-[#2A0A10] text-amber-500 focus:border-amber-500"
                    />
                    {allergy}
                  </label>
                ))}
              </div>
            </div>

            {/* Diet Goal */}
            <div>
              <label className="block text-sm font-medium text-amber-500 mb-2">Diet Goal</label>
              <select
                value={memberPreferences.dietGoal || ''}
                onChange={(e) => setMemberPreferences(prev => ({ ...prev, dietGoal: e.target.value as any || undefined }))}
                className="w-full bg-[#2A0A10] border border-red-900/50 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
              >
                <option value="">No specific goal</option>
                <option value="lose-weight">Lose Weight</option>
                <option value="maintain-weight">Maintain Weight</option>
                <option value="gain-weight">Gain Weight</option>
                <option value="build-muscle">Build Muscle</option>
                <option value="improve-health">Improve Health</option>
              </select>
            </div>

            {/* Favorite Cuisines */}
            <div>
              <label className="block text-sm font-medium text-amber-500 mb-2 flex items-center gap-2">
                <Heart className="w-4 h-4" />
                Favorite Cuisines
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['Italian', 'Mexican', 'Chinese', 'Japanese', 'Indian', 'Thai', 'French', 'Mediterranean', 'American', 'Korean'].map((cuisine) => (
                  <label key={cuisine} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={memberPreferences.favoriteCuisines?.includes(cuisine) || false}
                      onChange={(e) => {
                        const current = memberPreferences.favoriteCuisines || [];
                        if (e.target.checked) {
                          setMemberPreferences(prev => ({
                            ...prev,
                            favoriteCuisines: [...current, cuisine]
                          }));
                        } else {
                          setMemberPreferences(prev => ({
                            ...prev,
                            favoriteCuisines: current.filter(c => c !== cuisine)
                          }));
                        }
                      }}
                      className="rounded border-red-900/50 bg-[#2A0A10] text-amber-500 focus:border-amber-500"
                    />
                    {cuisine}
                  </label>
                ))}
              </div>
            </div>

            {/* Special Needs */}
            <div>
              <label className="block text-sm font-medium text-amber-500 mb-2">Special Dietary Needs</label>
              <textarea
                value={memberPreferences.specialNeeds || ''}
                onChange={(e) => setMemberPreferences(prev => ({ ...prev, specialNeeds: e.target.value }))}
                placeholder="Any special dietary needs, medical conditions, or preferences..."
                className="w-full bg-[#2A0A10] border border-red-900/50 rounded-lg px-3 py-2 text-sm text-white placeholder-red-200/50 focus:border-amber-500 outline-none resize-none"
                rows={3}
              />
            </div>

            {/* Preferred Proteins */}
            <div>
              <label className="block text-sm font-medium text-amber-500 mb-2">Preferred Proteins</label>
              <div className="grid grid-cols-2 gap-2">
                {['Chicken', 'Beef', 'Pork', 'Fish', 'Tofu', 'Tempeh', 'Lentils', 'Beans', 'Turkey', 'Lamb'].map((protein) => (
                  <label key={protein} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={memberPreferences.preferredProteins?.includes(protein) || false}
                      onChange={(e) => {
                        const current = memberPreferences.preferredProteins || [];
                        if (e.target.checked) {
                          setMemberPreferences(prev => ({
                            ...prev,
                            preferredProteins: [...current, protein]
                          }));
                        } else {
                          setMemberPreferences(prev => ({
                            ...prev,
                            preferredProteins: current.filter(p => p !== protein)
                          }));
                        }
                      }}
                      className="rounded border-red-900/50 bg-[#2A0A10] text-amber-500 focus:border-amber-500"
                    />
                    {protein}
                  </label>
                ))}
              </div>
            </div>

            {/* Disliked Ingredients */}
            <div>
              <label className="block text-sm font-medium text-amber-500 mb-2">Disliked Ingredients</label>
              <input
                type="text"
                value={memberPreferences.dislikedIngredients?.join(', ') || ''}
                onChange={(e) => setMemberPreferences(prev => ({ 
                  ...prev, 
                  dislikedIngredients: e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(s => s) : []
                }))}
                placeholder="Separate with commas (e.g., mushrooms, olives, cilantro)"
                className="w-full bg-[#2A0A10] border border-red-900/50 rounded-lg px-3 py-2 text-sm text-white placeholder-red-200/50 focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          <div className="p-4 bg-[#2A0A10] border-t border-red-900/50 flex gap-3">
            <button
              onClick={() => setShowMemberPreferences(false)}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveMemberPreferences}
              className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2 px-4 rounded-lg font-medium transition-colors"
            >
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main Household Modal (when not showing member preferences)
  if (!household) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-[#3F1016] border border-amber-500/30 w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="p-4 border-b border-red-900/50 flex justify-between items-center bg-[#2A0A10]">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              <h2 className="font-serif font-bold text-amber-50 text-lg">Create Household</h2>
            </div>
            <button onClick={onClose} className="text-red-200/50 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="p-6 pb-2.5">
            <div className="text-center">
              <Users className="w-16 h-16 text-amber-500/50 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Create Your Household</h3>
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
                  "Create Household"
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
          <button onClick={onClose} className="text-red-200/50 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Debug: Show user info */}
          <div className="bg-red-900/20 p-2 mb-4 text-xs text-red-200">
            User: {user.email} | Household: {household.name} | Members: {household.members?.length || 0}
            {household.members && Array.isArray(household.members) && household.members.find(m => m.email === user.email) && (
              <> | Role: {household.members.find(m => m.email === user.email)?.role}</>
            )}
            <br />
            Member emails: {household.members && Array.isArray(household.members) ? household.members.map(m => m.email).join(", ") : "none"}
            <br />
            User in members: {household.members && Array.isArray(household.members) ? (household.members.some(m => m.email === user.email) ? "YES" : "NO") : "N/A"}
            <br />
            Invite button visible: {(() => {
              const currentUser = household.members && Array.isArray(household.members) ? household.members.find(m => m.email === user.email) : null;
              return currentUser?.role === "admin" ? "YES (user is admin)" : `NO (${currentUser ? `user role: ${currentUser.role}` : "user not found in members"})`;
            })()}
          </div>

          {/* Temporarily force invite form to show for testing */}
          {true && (
            <PremiumFeature
              feature="householdMembers"
              user={user}
              limit={3}
              currentCount={household.members?.length || 0}
              fallbackMessage="Upgrade to Family plan to add more than 3 household members"
              onUpgrade={() => setActiveTab(Tab.SETTINGS)}
              >
                <div className="bg-[#2A0A10]/50 p-4 rounded-xl border border-red-900/30 mb-6">
                  <h3 className="text-sm font-bold text-amber-500 uppercase mb-3">Invite Family Member</h3>
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
          )}

          <h3 className="text-sm font-bold text-amber-500 uppercase mb-3 px-1">Group Members</h3>
          <div className="space-y-2">
            {household.members && Array.isArray(household.members) && household.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between bg-[#2A0A10] p-3 rounded-lg border border-red-900/30">
                <div className="flex items-center gap-3 flex-1">
                  <button 
                    onClick={() => {
                      const currentUser = household.members && Array.isArray(household.members) ? household.members.find(m => m.email === user.email) : null;
                      if (currentUser?.role === "admin") {
                        openMemberPreferences(member);
                      }
                    }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                      member.email === user.email ? "bg-amber-500 text-[#2A0A10]" : "bg-red-900/50 text-red-200 hover:bg-red-800/50"
                    } transition-colors`}
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
                    return currentUser?.role === "admin" && (
                      <button 
                        onClick={() => openMemberPreferences(member)}
                        className="text-red-900/50 hover:text-amber-500 p-2 transition-colors"
                        title="Edit member preferences"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    );
                  })()}
                  {(() => {
                    const currentUser = household.members && Array.isArray(household.members) ? household.members.find(m => m.email === user.email) : null;
                    return member.email !== user.email && currentUser?.role === "admin" && (
                      <button 
                        onClick={() => removeMember(member.id)}
                        className="text-red-900/50 hover:text-red-400 p-2"
                        title="Remove member"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    );
                  })()}
                </div>
              </div>
            ))}
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
};
