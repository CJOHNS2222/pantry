import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot, query, where, getDocs, updateDoc, collection } from 'firebase/firestore';
import { logEvent } from 'firebase/analytics';
import { User } from '../types';
import { analytics, db } from '../firebaseConfig';
import AnalyticsService from '../services/analyticsService';
import { setUserContext, clearUserContext, trackAuthEvent } from '../services/sentryService';
import { PriceDataCacheService } from '../services/priceDataCacheService';

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
        setIsAuthReady(true); // Auth is ready, even with no user
        return;
      }

      // Create user document if it doesn't exist
      const userDocRef = doc(db, 'users', fbUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        try {
          await setDoc(userDocRef, {
            subscription: {
              tier: 'premium',
              status: 'active',
              current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              cancel_at_period_end: false
            },
            createdAt: new Date(),
            email: fbUser.email,
            name: fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'User'),
          });
        } catch (err: any) {
          console.error('Failed to create user document:', err);
        }
      }

      // Set up listener for user document changes
      userDocUnsubscribe = onSnapshot(userDocRef, async (userDocSnap) => {
        const userData = userDocSnap.data();
        const householdId = userData?.householdId;

        if (!householdId) {
          try {
            const householdQuery = query(
              collection(db, 'households'),
              where('memberIds', 'array-contains', fbUser.uid)
            );
            const querySnapshot = await getDocs(householdQuery);
            if (!querySnapshot.empty) {
              const foundHouseholdId = querySnapshot.docs[0].id;
              await updateDoc(userDocRef, {
                householdId: foundHouseholdId,
                updatedAt: new Date()
              });
              return; // Listener will refire
            }
          } catch (err: any) {
            console.error('Failed to check for existing household:', err);
          }
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
          householdId: householdId
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
      await signOut(getAuth());
      // No need to call setUser(null), onAuthStateChanged will handle it.
      // No need for localStorage.clear() or window.location.reload()
    }
  };

  return { user, setUser, handleLogin, handleLogout, isAuthReady }; // Return new state
}
