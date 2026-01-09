import React, { useState } from 'react';
import { User, Household, Member } from '../types';
import { Users, Mail, Plus, X } from 'lucide-react';
import { getFunctions, httpsCallable } from "firebase/functions";
import { PremiumFeature } from './PremiumFeature';
import { Tab } from '../types/app';
import { addDoc, collection, doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { removeMemberFromHousehold } from '../services/householdService';
import { UsageService } from '../services/usageService';

interface HouseholdManagerProps {
  user: User;
  household: Household | null;
  setHousehold: React.Dispatch<React.SetStateAction<Household | null>>;
  onClose: () => void;
  setActiveTab: (tab: Tab) => void;
}

export const HouseholdManager: React.FC<HouseholdManagerProps> = ({ user, household, setHousehold, onClose, setActiveTab }) => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [householdName, setHouseholdName] = useState('');
  const [householdMemberLimitExceeded, setHouseholdMemberLimitExceeded] = useState(false);

  const checkHouseholdMemberLimit = async () => {
    try {
      const canAdd = await UsageService.canAddHouseholdMember(user.id);
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
      const functions = getFunctions();
      const inviteMember = httpsCallable(functions, 'inviteMember');
      
      // The cloud function returns the new member data upon success
      const result = await inviteMember({ email: inviteEmail, householdId: household.id });
      const { newMember } = result.data as { newMember: Member };

      // Update the local state with the official member data from the server
      setHousehold(prev => ({
        ...prev,
        members: [...prev.members, newMember]
      }));

      // Record the household member addition for usage tracking
      await UsageService.recordHouseholdMemberAdd(user.id);

      // Refresh the ID token to get updated custom claims
      await auth.currentUser?.getIdToken(true);

      setInviteEmail('');
      console.log("Invitation sent and member added as pending!");

    } catch (error) {
      console.error("Error sending invitation:", error);
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
          setHousehold(prev => ({ ...prev, members: [...prev.members, json.newMember] }));
          
          // Record the household member addition for usage tracking
          await UsageService.recordHouseholdMemberAdd(user.id);
          
          // Refresh the ID token to get updated custom claims
          await auth.currentUser?.getIdToken(true);
          
          setInviteEmail('');
          console.log('Invitation sent via HTTP fallback');
        }
      } catch (err) {
        console.error('Fallback HTTP invite error:', err);
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
      
      // Update local state
      setHousehold(prev => ({
        ...prev,
        members: prev.members.filter(m => m.id !== id),
        memberIds: prev.memberIds?.filter(mid => mid !== id)
      }));

      // If this was the last member, household will be deleted by the backend
      // Check if household still exists
      const updatedHousehold = { ...household };
      updatedHousehold.members = updatedHousehold.members.filter(m => m.id !== id);
      if (updatedHousehold.members.length === 1) {
        // Household was deleted
        setHousehold(null);
        onClose();
      }

    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member. Please try again.');
    }
  };

  const leaveHousehold = async () => {
    if (!confirm('Are you sure you want to leave this household? You will lose access to shared pantry items and meal plans.')) {
      return;
    }

    try {
      const functions = getFunctions();
      const leaveHouseholdFn = httpsCallable(functions, 'leaveHousehold');
      
      await leaveHouseholdFn({ householdId: household.id });
      
      // Clear household from local state
      setHousehold(null);
      localStorage.removeItem('household');
      onClose();
      
    } catch (error) {
      console.error('Error leaving household:', error);
      alert('Failed to leave household. Please try again.');
    }
  };

  const createHousehold = async () => {
    if (!householdName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const householdRef = doc(collection(db, 'households'));
      const newHousehold = {
        id: householdRef.id,
        name: householdName.trim(),
        createdAt: new Date(),
        memberIds: [user.id],
        members: [{
          id: user.id,
          name: user.name,
          email: user.email,
          role: 'Admin',
          status: 'Active'
        }]
      };

      await setDoc(householdRef, newHousehold);
      
      // Update local state
      setHousehold(newHousehold);
      localStorage.setItem('household', JSON.stringify(newHousehold));
      
      console.log('Household created successfully');
    } catch (error) {
      console.error('Error creating household:', error);
      alert('Failed to create household. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // Don't render if household is null
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
          <PremiumFeature
            feature="householdMembers"
            user={user}
            limit={3}
            currentCount={household.members.length}
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
                    className="w-full bg-[#2A0A10] border border-red-900/50 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-amber-500 outline-none"
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

          <h3 className="text-sm font-bold text-amber-500 uppercase mb-3 px-1">Group Members</h3>
          <div className="space-y-2">
            {household.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between bg-[#2A0A10] p-3 rounded-lg border border-red-900/30">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                    member.email === user.email ? 'bg-amber-500 text-[#2A0A10]' : 'bg-red-900/50 text-red-200'
                  }`}>
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white flex items-center gap-2">
                      {member.name} 
                      {member.email === user.email && <span className="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 rounded">YOU</span>}
                    </div>
                    <div className="text-xs text-red-200/50">{member.role} • {member.status}</div>
                  </div>
                </div>
                {member.email !== user.email && (
                  <button 
                    onClick={() => removeMember(member.id)}
                    className="text-red-900/50 hover:text-red-400 p-2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 pb-2.5 bg-[#2A0A10] border-t border-red-900/50">
          {household.members.find(m => m.email === user.email)?.role !== 'Admin' && (
            <div className="mb-3">
              <button
                onClick={leaveHousehold}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                Leave Household
              </button>
            </div>
          )}
          <p className="text-xs text-red-200/30 text-center">Changes are saved to your family group instantly.</p>
        </div>
      </div>
    </div>
  );
};
