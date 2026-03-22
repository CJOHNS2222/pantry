import React, { useState, useEffect } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { ChefHat, Mail, Chrome } from 'lucide-react';
import { User } from '../types';
import { Browser } from '@capacitor/browser';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { logEvent } from 'firebase/analytics';
import { analytics } from '../firebaseConfig';
import { validateEmail, validatePassword, validateName } from '../src/utils/validation';
import { log } from '../services/logService';



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

  // Debug timer to track when crash occurs
  useEffect(() => {
    log.debug('Login component mounted', { timestamp: new Date().toISOString() }, 'Login');
    const interval = setInterval(() => {
      log.debug('Login component still alive', { timestamp: new Date().toISOString() }, 'Login');
    }, 1000);

    return () => {
      log.debug('Login component unmounting', { timestamp: new Date().toISOString() }, 'Login');
      clearInterval(interval);
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
    
    if (isSignup) {
      // Validate name
      const nameValidation = validateName(name);
      if (!nameValidation.isValid) {
        setError('Please enter a valid name.');
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
        if (analytics) {
          logEvent(analytics, 'sign_up', { email: user.email, provider: 'email' });
        }
        setSuccess('Signup successful! Please check your email to verify your account.');
        onLogin({
          id: user.uid,
          name: name,
          email: user.email || '',
          provider: 'email',
          hasSeenTutorial: false
        });
        return;
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (analytics) {
          logEvent(analytics, 'login', { email: userCredential.user.email, provider: 'email' });
        }
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

  const handleGoogleLogin = async () => {
    try {
      const auth = getAuth();
      const googleProvider = new GoogleAuthProvider();
      googleProvider.addScope('email');
      googleProvider.addScope('profile');

      // For mobile, we need to handle the redirect differently
      if ((window as any).Capacitor && Browser) {
        // Set the redirect URL for mobile
        googleProvider.setCustomParameters({
          prompt: 'select_account',
          redirect_uri: 'com.smart.pantry://'
        });

        // Use redirect for mobile with Capacitor Browser
        await signInWithRedirect(auth, googleProvider);
      } else {
        // Desktop: Try popup first, fallback to redirect if popup fails
        try {
          const result = await signInWithPopup(auth, googleProvider);
          const user = result.user;
          if (analytics) {
            logEvent(analytics, 'login', { email: user.email, provider: 'google' });
          }
          onLogin({
            id: user.uid,
            name: user.displayName || user.email?.split('@')[0] || '',
            email: user.email || '',
            provider: 'google',
            hasSeenTutorial: false
          });
        } catch (popupError: any) {
          log.warn('Google popup failed, trying redirect', { error: popupError.message, code: popupError.code }, 'Login');
          // If popup is blocked or fails, use redirect as fallback
          if (popupError.code === 'auth/popup-blocked' ||
              popupError.code === 'auth/popup-closed-by-user' ||
              popupError.code === 'auth/cancelled-popup-request') {
            await signInWithRedirect(auth, googleProvider);
          } else {
            throw popupError;
          }
        }
      }
    } catch (error: any) {
      log.error('Google login error', error, 'Login');
      setError(<FormattedMessage id="auth.error.googleLoginFailed" values={{ message: error.message }} />);
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
        log.debug('Redirect result received', { hasUser: !!result?.user }, 'Login');
        if (result && result.user) {
          const user = result.user;
          log.info('User authenticated via redirect', { uid: user.uid, provider: 'google' }, 'Login');
          if (analytics) {
            logEvent(analytics, 'login', { email: user.email, provider: 'google' });
          }
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
      } catch (error: any) {
        log.warn('Redirect result error', { error: error.message, code: error.code }, 'Login');
        // Only show error if it's not a "no redirect result" scenario
        if (error.code !== 'auth/null-user' && error.code !== 'auth/user-cancelled') {
          setError(<FormattedMessage id="auth.error.googleLoginFailed" values={{ message: error.message }} />);
        }
      }
    };

    // Check immediately and also listen for auth state changes
    checkRedirect();

    // Also listen for auth state changes in case the redirect happens while component is mounted
    let unsubscribe = () => {};
    if (auth && typeof (auth as any).onAuthStateChanged === 'function') {
      unsubscribe = auth.onAuthStateChanged((user) => {
        if (user && user.providerData.some(provider => provider.providerId === 'google.com')) {
          // User is signed in with Google, trigger login callback
          if (analytics) {
            logEvent(analytics, 'login', { email: user.email, provider: 'google' });
          }
          onLogin({
            id: user.uid,
            name: user.displayName || user.email?.split('@')[0] || '',
            email: user.email || '',
            provider: 'google',
            hasSeenTutorial: false
          });
        }
      });
    }

    return unsubscribe;
  }, [onLogin]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#2A0A10] text-white relative overflow-auto">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-[#2A0A10] to-[#2A0A10] z-0 pointer-events-none"></div>

      <div className="w-full max-w-md bg-[#3F1016] border border-red-900/30 rounded-3xl p-8 shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg mb-4">
            <ChefHat className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold font-serif tracking-wide text-amber-50">
            <FormattedMessage id="app.name" />
          </h1>
          <p className="text-red-200/60 mt-2 text-sm uppercase tracking-widest">
            <FormattedMessage id="app.tagline" />
          </p>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {error && <div className="text-red-400 text-xs mb-2" aria-live="polite">{error}</div>}
          {success && <div className="text-green-400 text-xs mb-2">{success}</div>}
          {isSignup && (
            <div>
              <label htmlFor="name" className="block text-xs font-bold text-amber-500 uppercase mb-1 ml-1">
                <FormattedMessage id="auth.name" />
              </label>
              <input
                id="name"
                  name="name"
                  data-testid="login-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#2A0A10] border border-red-900/50 rounded-xl px-4 py-3 text-white placeholder-red-900/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                placeholder={intl.formatMessage({ id: "auth.yourName" })}
                autoComplete="name"
                required
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-xs font-bold text-amber-500 uppercase mb-1 ml-1">
              <FormattedMessage id="auth.email" />
            </label>
            <input
              id="email"
                name="email"
                data-testid="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#2A0A10] border border-red-900/50 rounded-xl px-4 py-3 text-white placeholder-red-900/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
              placeholder={intl.formatMessage({ id: "auth.emailPlaceholder" })}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-bold text-amber-500 uppercase mb-1 ml-1">
              <FormattedMessage id="auth.password" />
            </label>
            <input
              id="password"
                name="password"
                data-testid="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#2A0A10] border border-red-900/50 rounded-xl px-4 py-3 text-white placeholder-red-900/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
              placeholder={intl.formatMessage({ id: "auth.passwordPlaceholder" })}
              autoComplete="current-password"
              required
            />
             {!isSignup && (
               <button
                 type="button"
                 onClick={handleForgotPassword}
                 className="w-full mt-2 text-amber-400 underline text-xs text-left hover:text-amber-500"
                 data-testid="login-forgot-password"
               >
                 <FormattedMessage id="auth.forgotPassword" />
               </button>
             )}
          </div>
          {isSignup && (
            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-bold text-amber-500 uppercase mb-1 ml-1">
                <FormattedMessage id="auth.confirmPassword" />
              </label>
              <input
                id="confirmPassword"
                  name="confirmPassword"
                  data-testid="login-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#2A0A10] border border-red-900/50 rounded-xl px-4 py-3 text-white placeholder-red-900/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
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
          <div className="h-px bg-red-900/30 flex-1"></div>
          <span className="text-xs text-red-200/40 font-medium">
            <FormattedMessage id="auth.orContinueWith" />
          </span>
          <div className="h-px bg-red-900/30 flex-1"></div>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="flex items-center justify-center gap-2 bg-white text-gray-800 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors"
            data-testid="login-google"
          >
            <Chrome className="w-5 h-5 text-red-500" />
            Google
          </button>
        </div>
      </div>
    </div>
  );
};