import React, { useState, useEffect } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { LogIn, UserX } from 'lucide-react';
import { User } from '../../types';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, sendEmailVerification, sendPasswordResetEmail, signInWithCredential } from 'firebase/auth';
import AnalyticsService from '../../services/analyticsService';
import { validateEmail, validatePassword, validateName } from '../../src/utils/validation';
import { log } from '../../services/logService';

export const GUEST_USER_ID_KEY = 'guest_user_id';



interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const intl = useIntl();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    log.debug('Login component mounted', {}, 'Login');
    return () => {
      log.debug('Login component unmounting', {}, 'Login');
    };
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setError('Please enter a valid email address.');
      return;
    }
    
    // Validate password (only for signup)
    if (isSignup) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        setError('Password must be at least 8 characters and contain uppercase, lowercase, number, and special character.');
        return;
      }
    }
    
    const trimmedName = name.trim();
    if (isSignup) {
      // Validate name
      const nameValidation = validateName(trimmedName);
      if (!nameValidation.isValid) {
        setError(nameValidation.errors[0] || 'Please enter a valid name.');
        return;
      }
      
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }
    try {
      const auth = getAuth();
      let userCredential;
      if (isSignup) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await sendEmailVerification(user);
        AnalyticsService.trackSignup('email');
        setSuccess('Signup successful! Please check your email to verify your account.');
        onLogin({
          id: user.uid,
          name: trimmedName,
          email: user.email || '',
          provider: 'email',
          hasSeenTutorial: false
        });
        return;
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        AnalyticsService.trackLogin('email');
        setSuccess('Login successful!');
        const user = userCredential.user;
        onLogin({
          id: user.uid,
          name: user.displayName || user.email?.split('@')[0] || '',
          email: user.email || '',
          provider: 'email',
          hasSeenTutorial: false
        });
      }
    } catch (error) {
      setError((isSignup ? 'Signup' : 'Login') + ' failed: ' + (error as Error).message);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setSuccess(null);
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setError('Please enter your email address above to reset password.');
      return;
    }
    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, email);
      setSuccess('Password reset email sent! Please check your inbox.');
    } catch (error) {
      setError('Failed to send reset email: ' + (error as Error).message);
    }
  };

  const handleGuestLogin = () => {
    let guestId = localStorage.getItem(GUEST_USER_ID_KEY);
    if (!guestId) {
      guestId = `guest-${crypto.randomUUID()}`;
      localStorage.setItem(GUEST_USER_ID_KEY, guestId);
    }
    AnalyticsService.trackLogin('guest');
    onLogin({
      id: guestId,
      name: 'Guest',
      email: '',
      provider: 'guest',
      isGuest: true,
      hasSeenTutorial: false
    });
  };

  const handleGoogleLogin = async () => {
    try {
      const auth = getAuth();

      // Native Capacitor path — uses native Google Sign-In to avoid localhost redirect issue
      if (Capacitor.getPlatform() !== 'web') {
        await GoogleAuth.initialize({
          clientId: '13848266518-0co4dav6sn9epov13vt0covii2nmg1ne.apps.googleusercontent.com',
          scopes: ['profile', 'email'],
          grantOfflineAccess: true,
        });
        const googleUser = await GoogleAuth.signIn();
        const idToken = googleUser.authentication.idToken;
        const credential = GoogleAuthProvider.credential(idToken);
        const result = await signInWithCredential(auth, credential);
        const user = result.user;
        AnalyticsService.trackLogin('google');
        onLogin({
          id: user.uid,
          name: user.displayName || user.email?.split('@')[0] || '',
          email: user.email || '',
          provider: 'google',
          hasSeenTutorial: false
        });
        return;
      }

      // Web path: popup first, redirect fallback
      const googleProvider = new GoogleAuthProvider();
      googleProvider.addScope('email');
      googleProvider.addScope('profile');
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        AnalyticsService.trackLogin('google');
        onLogin({
          id: user.uid,
          name: user.displayName || user.email?.split('@')[0] || '',
          email: user.email || '',
          provider: 'google',
          hasSeenTutorial: false
        });
      } catch (popupError: unknown) {
        const err = popupError as { message?: string; code?: string };
        log.warn('Google popup failed, trying redirect', { error: err.message, code: err.code }, 'Login');
        if (err.code === 'auth/popup-blocked' ||
            err.code === 'auth/popup-closed-by-user' ||
            err.code === 'auth/cancelled-popup-request') {
          await signInWithRedirect(auth, googleProvider);
        } else {
          throw popupError;
        }
      }
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string };
      log.error('Google login error', { code: err.code, message: err.message }, 'Login');
      const friendlyMessage = (() => {
        switch (err.code) {
          case 'auth/unauthorized-domain':
            return 'This domain is not authorized in Firebase. Add it under Authentication → Settings → Authorized Domains.';
          case 'auth/popup-blocked':
            return 'Popup was blocked by your browser. Please allow popups and try again.';
          case 'auth/network-request-failed':
            return 'Network error. Please check your connection and try again.';
          case 'auth/cancelled-popup-request':
          case 'auth/popup-closed-by-user':
            return null; // user dismissed — show nothing
          default:
            return `${err.message || 'Unknown error'}${err.code ? ` (${err.code})` : ''}`;
        }
      })();
      if (friendlyMessage) setError(friendlyMessage);
    }
  };

  // Handle Google redirect result (for mobile and fallback)
  useEffect(() => {
    log.debug('Login component mounted, checking for redirect result', {}, 'Login');
    const auth = getAuth();
    const checkRedirect = async () => {
      try {
        log.debug('Checking redirect result', {}, 'Login');
        const result = await getRedirectResult(auth);
        log.debug('Redirection result received', { hasUser: !!(result && result.user) }, 'Login');
        if (result && result.user) {
          const user = result.user;
          log.info('User authenticated via redirect', { uid: user.uid, provider: 'google' }, 'Login');
          AnalyticsService.trackLogin('google');
          onLogin({
            id: user.uid,
            name: user.displayName || user.email?.split('@')[0] || '',
            email: user.email || '',
            provider: 'google',
            hasSeenTutorial: false
          });
        } else {
          log.debug('No redirect result found', {}, 'Login');
        }
      } catch (error: unknown) {
        const err = error as { message?: string; code?: string };
        log.warn('Redirection result error', { error: err.message, code: err.code }, 'Login');
        // Only show error if it's not a "no redirect result" scenario
        if (err.code !== 'auth/null-user' && err.code !== 'auth/user-cancelled') {
          setError(`${err.message || 'Unknown error'}${err.code ? ` (${err.code})` : ''}`);
        }
      }
    };

    // Check immediately and also listen for auth state changes
    checkRedirect();

    // Also listen for auth state changes in case the redirect happens while component is mounted
    let unsubscribe = () => { return; };
    if (auth && typeof auth.onAuthStateChanged === 'function') {
      const sub = auth.onAuthStateChanged((user) => {
        if (user && user.providerData.some(provider => provider.providerId === 'google.com')) {
          // User is signed in with Google, trigger login callback
          AnalyticsService.trackLogin('google');
          onLogin({
            id: user.uid,
            name: user.displayName || user.email?.split('@')[0] || '',
            email: user.email || '',
            provider: 'google',
            hasSeenTutorial: false
          });
        }
      });
      unsubscribe = sub;
    }

    return unsubscribe;
  }, [onLogin]);

  return (
    <div className="min-h-[100dvh] w-full flex flex-col overflow-y-auto bg-slate-950 text-white relative">
      {/* Background Ambience */}
      <div className="fixed inset-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-500/10 via-slate-950 to-slate-950 z-0 pointer-events-none"></div>

      <div className="flex-grow flex-shrink-0"></div>

      <div className="w-full max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 my-8 flex-shrink-0">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg mb-4 overflow-hidden">
            <img src="/icons/icon.png" alt="App Icon" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-3xl font-bold font-serif tracking-wide text-amber-50">
            <FormattedMessage id="app.name" />
          </h1>
          <p className="text-slate-400 mt-2 text-sm uppercase tracking-widest">
            <FormattedMessage id="app.tagline" />
          </p>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {error && <div className="text-red-400 text-sm mb-2" aria-live="polite">{error}</div>}
          {success && <div className="text-green-400 text-sm mb-2">{success}</div>}
          {isSignup && (
            <div>
              <label htmlFor="name" className="block text-sm font-bold text-amber-500 uppercase mb-1 ml-1">
                <FormattedMessage id="auth.name" />
              </label>
              <input
                id="name"
                  name="name"
                  data-testid="login-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                placeholder={intl.formatMessage({ id: "auth.yourName" })}
                autoComplete="name"
                required
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-bold text-amber-500 uppercase mb-1 ml-1">
              <FormattedMessage id="auth.email" />
            </label>
            <input
              id="email"
                name="email"
                data-testid="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
              placeholder={intl.formatMessage({ id: "auth.emailPlaceholder" })}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-bold text-amber-500 uppercase mb-1 ml-1">
              <FormattedMessage id="auth.password" />
            </label>
            <input
              id="password"
                name="password"
                data-testid="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
              placeholder={intl.formatMessage({ id: "auth.passwordPlaceholder" })}
              autoComplete="current-password"
              required
            />
             {!isSignup && (
               <button
                 type="button"
                 onClick={handleForgotPassword}
                 className="w-full mt-2 text-amber-400 underline text-sm text-left hover:text-amber-500"
                 data-testid="login-forgot-password"
               >
                 <FormattedMessage id="auth.forgotPassword" />
               </button>
             )}
          </div>
          {isSignup && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-bold text-amber-500 uppercase mb-1 ml-1">
                <FormattedMessage id="auth.confirmPassword" />
              </label>
              <input
                id="confirmPassword"
                  name="confirmPassword"
                  data-testid="login-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                placeholder={intl.formatMessage({ id: "auth.confirmPasswordPlaceholder" })}
                autoComplete="new-password"
                required
              />
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-amber-500 to-amber-700 text-white font-bold py-3.5 rounded-xl hover:shadow-lg hover:shadow-amber-900/20 transition-all transform active:scale-95 mt-2"
            data-testid="login-submit"
          >
            <FormattedMessage id={isSignup ? "auth.signUp" : "auth.signIn"} />
          </button>
          <button
            type="button"
            onClick={() => setIsSignup(!isSignup)}
            className="w-full mt-2 text-amber-500 underline text-sm"
            data-testid="login-toggle-signup"
          >
            <FormattedMessage id={isSignup ? "auth.alreadyHaveAccount" : "auth.dontHaveAccount"} />
          </button>
        </form>

        <div className="my-6 flex items-center gap-4">
          <div className="h-px bg-slate-800 flex-1"></div>
          <span className="text-xs text-slate-500 font-medium">
            <FormattedMessage id="auth.orContinueWith" />
          </span>
          <div className="h-px bg-slate-800 flex-1"></div>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="flex items-center justify-center gap-2 bg-white text-gray-800 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors"
            data-testid="login-google"
          >
            <LogIn className="w-5 h-5 text-red-500" />
            Google
          </button>
          <button
            type="button"
            onClick={handleGuestLogin}
            className="flex items-center justify-center gap-2 bg-transparent border border-slate-700 text-slate-300 font-medium py-3 rounded-xl hover:bg-slate-800/50 transition-colors"
            data-testid="login-guest"
          >
            <UserX className="w-5 h-5" />
            Continue as Guest
          </button>
        </div>
        <p className="text-sm text-slate-500 text-center mt-3">
          Guest mode: local storage only, no cross-device sync.
        </p>
      </div>
      
      <div className="flex-grow flex-shrink-0"></div>
    </div>
  );
};