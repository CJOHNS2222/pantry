import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import DatabaseMonitoringService from '../services/databaseMonitoringService';
import { logEvent } from 'firebase/analytics';
import { User } from '../types';
import { analytics } from '../firebaseConfig';
import AnalyticsService from '../services/analyticsService';
import { setUserContext, clearUserContext, trackAuthEvent } from '../services/sentryService';
import { PriceDataCacheService } from '../services/priceDataCacheService';
import { log } from '../services/logService';
import { GUEST_USER_ID_KEY } from '../components/auth-onboarding/Login';
import { syncFromFirestore } from '../services/onboardingMilestoneService';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false); // New state

  useEffect(() => {
    const auth = getAuth();
    let userDocUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      // Clean up previous user document listener
      if (userDocUnsubscribe) {
        userDocUnsubscribe();
        userDocUnsubscribe = null;
      }

      if (!fbUser) {
        setUser(null);
        clearUserContext();
        PriceDataCacheService.clearCache(); // Clear cache on logout

        // Restore a guest session if the user had previously chosen guest mode
        const guestId = localStorage.getItem(GUEST_USER_ID_KEY);
        if (guestId) {
          setUser({
            id: guestId,
            name: 'Guest',
            email: '',
            provider: 'guest',
            isGuest: true,
            hasSeenTutorial: false,
            discoveredFeatures: [],
            dismissedTutorialTips: []
          });
        }

        setIsAuthReady(true); // Auth is ready, even with no user
        return;
      }

      const userDocRef = DatabaseMonitoringService.doc('users', fbUser.uid);

      // Set up listener for user document changes (handles doc creation on first login)
      userDocUnsubscribe = DatabaseMonitoringService.onSnapshot(userDocRef, async (userDocSnap) => {
        if (!userDocSnap.exists()) {
          try {
            await DatabaseMonitoringService.setDoc(userDocRef, {
              subscription: {
                tier: 'free',
                status: 'active',
                current_period_end: new Date(),
                cancel_at_period_end: false
              },
              createdAt: new Date(),
              email: fbUser.email,
              name: fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'User'),
            });
          } catch (err: unknown) {
            log.error('Failed to create user document:', { error: (err as Error)?.message }, 'useAuth');
          }
          return; // Listener will re-fire once doc is created
        }

        const userData = userDocSnap.data();
        const householdId = userData?.householdId;

        if (!householdId) {
          try {
            const householdQuery = DatabaseMonitoringService.query(
              DatabaseMonitoringService.collection('households'),
              DatabaseMonitoringService.where('memberIds', 'array-contains', fbUser.uid)
            );
            const querySnapshot = await DatabaseMonitoringService.getDocs(householdQuery);
            if (!querySnapshot.empty) {
              const foundHouseholdId = querySnapshot.docs[0].id;
              await DatabaseMonitoringService.updateDoc(userDocRef, {
                householdId: foundHouseholdId,
                updatedAt: new Date()
              });
              return; // Listener will refire
            }
          } catch (err: unknown) {
            log.error('Failed to check for existing household:', { error: (err as Error)?.message }, 'useAuth');
          }
        }

        // Synchronize onboarding milestones from Firestore if they exist
        if (Array.isArray(userData?.onboardingMilestones)) {
          syncFromFirestore(userData.onboardingMilestones);
        }

        // One-time migration: move customCategories from old subcollection cache to user doc.
        // After migration the user doc update triggers this listener again with the field present.
        let customCategories = userData?.customCategories;
        if (!customCategories) {
          try {
            const oldCacheRef = DatabaseMonitoringService.doc(`users/${fbUser.uid}/cache/customCategories`);
            const oldCacheSnap = await DatabaseMonitoringService.getDoc(oldCacheRef);
            if (oldCacheSnap.exists()) {
              const legacyCategories = oldCacheSnap.data()?.categories || [];
              await DatabaseMonitoringService.updateDoc(userDocRef, { customCategories: legacyCategories });
              return; // Listener will refire with the new field set
            }
          } catch (err: unknown) {
            log.warn('Could not migrate customCategories from cache', { error: (err as Error)?.message }, 'useAuth');
          }
          customCategories = [];
        }

        setUser({
          id: fbUser.uid,
          name: userData?.name || fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'User'),
          email: fbUser.email || '',
          avatar: userData?.avatar || fbUser.photoURL || undefined,
          provider: fbUser.providerData?.[0]?.providerId?.includes('google') ? 'google' : 'email',
          hasSeenTutorial: userData?.hasSeenTutorial ?? false,
          subscription: userData?.subscription,
          profile: userData?.profile,
          householdId: householdId,
          customCategories,
          discoveredFeatures: userData?.discoveredFeatures || [],
          dismissedTutorialTips: userData?.dismissedTutorialTips || [],
        });

        setUserContext(fbUser.uid, fbUser.email || undefined, householdId);
        setIsAuthReady(true); // Auth is ready
      });
    });

    return () => {
      unsubscribe();
      if (userDocUnsubscribe) {
        userDocUnsubscribe();
      }
    };
  }, []);

  // No longer need to persist user to localStorage, auth state is the source of truth

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser); // This might be redundant if onAuthStateChanged works as expected
    trackAuthEvent('login', { method: loggedInUser.provider });
    if (analytics) {
      logEvent(analytics, 'login', { method: loggedInUser.provider });
    }
  };

  const handleLogout = async () => {
    if (confirm("Are you sure you want to log out?")) {
      trackAuthEvent('logout');
      AnalyticsService.trackLogout();
      // Guest users have no Firebase session — just clear localStorage
      const currentUser = await new Promise<User | null>(resolve => resolve(null)).then(() => null);
      void currentUser; // unused, just keeping async shape
      const guestId = localStorage.getItem(GUEST_USER_ID_KEY);
      if (guestId) {
        localStorage.removeItem(GUEST_USER_ID_KEY);
        // Also clear guest data from localStorage
        localStorage.removeItem('guest_inventory');
        localStorage.removeItem('guest_shopping');
        localStorage.removeItem('guest_recipes');
        localStorage.removeItem('guest_mealplan');
        setUser(null);
        return;
      }
      await signOut(getAuth());
      // No need to call setUser(null), onAuthStateChanged will handle it.
    }
  };

  return { user, setUser, handleLogin, handleLogout, isAuthReady }; // Return new state
}
