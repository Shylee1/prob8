import React, { useState } from 'react';
import { Lock, Mail, Moon, ShieldCheck, Sparkles, Sun, UserPlus } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { isFounderAdminEmail } from '../services/dataService';
import type { RegisteredUserRecord } from '../types';

interface AuthGateModalProps {
  registeredUsers: RegisteredUserRecord[];
  referredByCode?: string;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenAffiliatePortal: () => void;
  onAuthenticateSuccess: (user: RegisteredUserRecord, updatedUsers?: RegisteredUserRecord[]) => void;
}

export const AuthGateModal: React.FC<AuthGateModalProps> = ({
  registeredUsers,
  referredByCode,
  isDark,
  onToggleTheme,
  onOpenAffiliatePortal,
  onAuthenticateSuccess,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMsg('Enter both your email address and password.');
      return;
    }

    setIsBusy(true);
    try {
      if (isSupabaseConfigured && supabase) {
        if (mode === 'signup') {
          const { data, error } = await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: { data: { full_name: fullName.trim() || cleanEmail.split('@')[0], referred_by: referredByCode } },
          });
          if (error) {
            setErrorMsg(error.message);
            return;
          }
          const uid = data.user?.id || `user-${Date.now().toString(36)}`;
          const newUser: RegisteredUserRecord = {
            id: uid,
            email: cleanEmail,
            fullName: fullName.trim() || cleanEmail.split('@')[0],
            signedUpAt: new Date().toISOString(),
            subscriptionTier: 'free',
            isAdmin: false,
            forcePasswordChange: false,
          };
          onAuthenticateSuccess(newUser, [...registeredUsers, newUser]);
          return;
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
          if (!error && data.user) {
            const { data: profileRow } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .maybeSingle();
            const loggedUser: RegisteredUserRecord = {
              id: data.user.id,
              email: cleanEmail,
              fullName: profileRow?.full_name || cleanEmail.split('@')[0],
              signedUpAt: profileRow?.created_at || new Date().toISOString(),
              subscriptionTier: isFounderAdminEmail(cleanEmail)
                ? 'vip_lifetime'
                : profileRow?.subscription_tier || 'free',
              isAdmin: isFounderAdminEmail(cleanEmail),
              forcePasswordChange: Boolean(profileRow?.force_password_change),
              status: 'active',
            };
            const merged = registeredUsers.some((u) => u.email === cleanEmail)
              ? registeredUsers.map((u) => (u.email === cleanEmail ? loggedUser : u))
              : [...registeredUsers, loggedUser];
            onAuthenticateSuccess(loggedUser, merged);
            return;
          }
        }
      }

      // Local / preview auth registry supporting standard accounts + busapower07@gmail.com seed
      if (mode === 'signup') {
        if (registeredUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
          setErrorMsg('An account with that email already exists. Switch to Sign In.');
          return;
        }
        if (password.length < 6) {
          setErrorMsg('Choose a password with at least 6 characters.');
          return;
        }
        const created: RegisteredUserRecord = {
          id: `usr-${Date.now().toString(36)}`,
          email: cleanEmail,
          fullName: fullName.trim() || cleanEmail.split('@')[0],
          signedUpAt: new Date().toISOString(),
          subscriptionTier: 'free',
          isAdmin: false,
          forcePasswordChange: false,
          passwordHashOrPlain: password,
        };
        onAuthenticateSuccess(created, [...registeredUsers, created]);
        return;
      }

      const existing = registeredUsers.find((u) => u.email.toLowerCase() === cleanEmail);
      if (!existing) {
        setErrorMsg('No account found for that email. Create a free account in one click below.');
        return;
      }
      if (existing.status === 'suspended') {
        setErrorMsg('This account has been suspended by the administrator.');
        return;
      }
      if (existing.passwordHashOrPlain && existing.passwordHashOrPlain !== password) {
        setErrorMsg('Incorrect password. Please check your credentials.');
        return;
      }
      onAuthenticateSuccess({
        ...existing,
        isAdmin: isFounderAdminEmail(existing.email),
        subscriptionTier: isFounderAdminEmail(existing.email) ? 'vip_lifetime' : existing.subscriptionTier,
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signInWithOAuth({ provider: 'google' });
      return;
    }
    const demoEmail = 'google.investor@prob8.app';
    let user = registeredUsers.find((u) => u.email === demoEmail);
    let nextUsers = registeredUsers;
    if (!user) {
      user = {
        id: 'usr-google-investor',
        email: demoEmail,
        fullName: 'Google Investor Account',
        signedUpAt: new Date().toISOString(),
        subscriptionTier: 'free',
        isAdmin: false,
        forcePasswordChange: false,
      };
      nextUsers = [...registeredUsers, user];
    }
    onAuthenticateSuccess(user, nextUsers);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center bg-[#F8FAFC] dark:bg-[#090D16] px-4 py-10 transition-colors">
      <div className="absolute right-4 top-4">
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label="Toggle color theme"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-700 dark:text-amber-300"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="text-center space-y-2.5">
          <img
            src="/icon.svg?v=3"
            alt="Prob8 Logo"
            className="mx-auto h-20 w-20 rounded-[22px] shadow-xl shadow-slate-950/25 ring-1 ring-white/10"
          />
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Welcome to Prob8
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Nationwide Probate Search, Live Auctions &amp; Multi-Asset Deal Underwriting.
          </p>
          {referredByCode && (
            <p className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-[#0F766E] dark:text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" />
              Referred by Partner Code: {referredByCode}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-xl space-y-5">
          <div className="grid grid-cols-2 rounded-xl border border-slate-200 dark:border-slate-800 p-1 bg-slate-50 dark:bg-[#090D16]">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
              }}
              className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                mode === 'signin'
                  ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
              }}
              className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                mode === 'signup'
                  ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Create Free Account
            </button>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label htmlFor="auth-fullname" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Full Name
                </label>
                <input
                  id="auth-fullname"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Mercer"
                  className="mt-1 w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3.5 text-sm text-slate-900 dark:text-white"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email Address
              </label>
              <div className="relative mt-1">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] pl-10 pr-3.5 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Password
              </label>
              <div className="relative mt-1">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="auth-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] pl-10 pr-3.5 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isBusy}
              className="w-full h-11 rounded-xl bg-[#0F766E] text-sm font-semibold text-white hover:bg-[#0D625B] disabled:opacity-60 transition-colors"
            >
              {isBusy
                ? 'Authenticating...'
                : mode === 'signin'
                  ? 'Sign In to Prob8'
                  : 'Create Free Tier Account'}
            </button>
          </form>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
            <span className="mx-3 text-[11px] font-medium text-slate-400">OR</span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="flex w-full h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <UserPlus className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />
            Continue with Google
          </button>

          <button
            type="button"
            onClick={() => {
              const testUser = registeredUsers.find((u) => u.email.toLowerCase() === 'testuser@prob8.app');
              if (testUser) {
                onAuthenticateSuccess({
                  ...testUser,
                  isAdmin: false,
                  subscriptionTier: testUser.subscriptionTier,
                });
              }
            }}
            className="w-full h-9 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-[#0F766E] hover:text-[#0F766E] dark:hover:text-emerald-400 transition-colors"
          >
            Sign In with Test User Account (testuser@prob8.app · Free Tier)
          </button>

          <button
            type="button"
            onClick={onOpenAffiliatePortal}
            className="w-full h-9 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 transition-colors"
          >
            Become an Affiliate · Earn 30% Recurring + $150/Lifetime
          </button>

          <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
            <ShieldCheck className="h-3.5 w-3.5 text-[#0F766E] dark:text-emerald-400 shrink-0" />
            Zero data harvesting · Starts on Free Tier with nationwide search.
          </p>
        </div>
      </div>
    </div>
  );
};
