import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot, query, where, getDocs, updateDoc, collection } from 'firebase/firestore';
import { logEvent } from 'firebase/analytics';
import { User } from '../types';
import { analytics, db } from '../firebaseConfig';
import AnalyticsService from '../services/analyticsService';
import { setUserContext, clearUserContext, trackAuthEvent } from '../services/sentryService';

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

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
        return;
      }

      // Create user document if it doesn't exist
      const userDocRef = doc(db, 'users', fbUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        try {
          // Create user document with default subscription
          await setDoc(userDocRef, {
            subscription: {
              tier: 'premium',
              status: 'active',
              current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
              cancel_at_period_end: false
            },
            createdAt: new Date(),
            email: fbUser.email,
            // Don't set name here - it will be set by handleLogin
            name: null
          });
        } catch (error) {
          console.error('Failed to create user document:', error);
        }
      }

      // Set up listener for user document changes
      userDocUnsubscribe = onSnapshot(userDocRef, async (userDocSnap) => {
        const userData = userDocSnap.data();
        const householdId = userData?.householdId;

        // If householdId is not set, check if user is in any household
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
              // The onSnapshot will fire again with the updated data
              return;
            }
          } catch (error) {
            console.error('Failed to check for existing household:', error);
          }
        }

        setUser({
          id: fbUser.uid,
          name: userData?.name || fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'User'),
          email: fbUser.email || '',
          avatar: userData?.avatar || fbUser.photoURL || undefined,
          provider: fbUser.providerData?.[0]?.providerId?.includes('google') ? 'google' : 'email',
          hasSeenTutorial: user?.hasSeenTutorial ?? false,
          subscription: userData?.subscription,
          profile: userData?.profile,
          householdId: householdId
        });

        // Set Sentry user context
        setUserContext(fbUser.uid, fbUser.email || undefined, householdId);
      });
    });

    return () => {
      unsubscribe();
      if (userDocUnsubscribe) {
        userDocUnsubscribe();
      }
    };
  }, []);

  // Persist user to localStorage
  useEffect(() => {
    localStorage.setItem('user', JSON.stringify(user));
  }, [user]);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    trackAuthEvent('login', { method: loggedInUser.provider });
    if (analytics) {
      logEvent(analytics, 'login', { method: loggedInUser.provider });
    }
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to log out?")) {
      trackAuthEvent('logout');
      AnalyticsService.trackLogout();
      signOut(getAuth());
      setUser(null);
      localStorage.clear();
      window.location.reload();
    }
  };

  return { user, setUser, handleLogin, handleLogout };
}