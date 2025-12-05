import React, { useState } from 'react';
import { ChefHat, Mail, Facebook, Chrome } from 'lucide-react';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      onLogin({
        id: Math.random().toString(36).substr(2, 9),
        name: email.split('@')[0],
        email: email,
        provider: 'email',
        hasSeenTutorial: false
      });
    }
  };

  const handleSocialLogin = (provider: 'google' | 'facebook') => {
    // Simulate social login
    onLogin({
      id: Math.random().toString(36).substr(2, 9),
      name: `User via ${provider}`,
      email: `user@${provider}.com`,
      provider: provider,
      hasSeenTutorial: false
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#2A0A10] text-white relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-[#2A0A10] to-[#2A0A10] z-0"></div>

      <div className="w-full max-w-md bg-[#3F1016] border border-red-900/30 rounded-3xl p-8 shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg mb-4">
            <ChefHat className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold font-serif tracking-wide text-amber-50">
            Smart Pantry Chef
          </h1>
          <p className="text-red-200/60 mt-2 text-sm uppercase tracking-widest">
            Your Personal AI Sous Chef
          </p>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-amber-500 uppercase mb-1 ml-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#2A0A10] border border-red-900/50 rounded-xl px-4 py-3 text-white placeholder-red-900/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
              placeholder="chef@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-amber-500 uppercase mb-1 ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#2A0A10] border border-red-900/50 rounded-xl px-4 py-3 text-white placeholder-red-900/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-amber-500 to-amber-700 text-white font-bold py-3.5 rounded-xl hover:shadow-lg hover:shadow-amber-900/20 transition-all transform active:scale-95 mt-2"
          >
            Sign In
          </button>
        </form>

        <div className="my-6 flex items-center gap-4">
          <div className="h-px bg-red-900/30 flex-1"></div>
          <span className="text-xs text-red-200/40 font-medium">OR CONTINUE WITH</span>
          <div className="h-px bg-red-900/30 flex-1"></div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handleSocialLogin('google')}
            className="flex items-center justify-center gap-2 bg-white text-gray-800 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Chrome className="w-5 h-5 text-red-500" />
            Google
          </button>
          <button
            type="button"
            onClick={() => handleSocialLogin('facebook')}
            className="flex items-center justify-center gap-2 bg-[#1877F2] text-white font-medium py-3 rounded-xl hover:bg-[#166fe5] transition-colors"
          >
            <Facebook className="w-5 h-5" />
            Facebook
          </button>
        </div>
      </div>
    </div>
  );
};