import React, { useState } from 'react';
import { Lock, ShieldAlert } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

interface ForcePasswordModalProps {
  userEmail: string;
  userId: string;
  onPasswordUpdated: (newPassword: string) => void;
}

export const ForcePasswordModal: React.FC<ForcePasswordModalProps> = ({
  userEmail,
  userId,
  onPasswordUpdated,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword === '123') {
      setError('You must replace the temporary password with a strong new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSaving(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { error: authErr } = await supabase.auth.updateUser({ password: newPassword });
        if (authErr) {
          setError(authErr.message);
          return;
        }
        await supabase
          .from('profiles')
          .update({ force_password_change: false })
          .eq('id', userId);
      }
      onPasswordUpdated(newPassword);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mandatory Security Password Update"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-white dark:bg-[#111827] p-6 shadow-2xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Security Update Required
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Signed in as Founder Admin (<span className="font-mono font-semibold">{userEmail}</span>). Set a strong permanent password before accessing Prob8.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="force-new-pw" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              New Strong Password (8+ characters)
            </label>
            <div className="relative mt-1">
              <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="force-new-pw"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] pl-9 pr-3 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label htmlFor="force-confirm-pw" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Confirm New Password
            </label>
            <div className="relative mt-1">
              <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="force-confirm-pw"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] pl-9 pr-3 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full h-11 rounded-xl bg-[#0F766E] text-sm font-semibold text-white hover:bg-[#0D625B] disabled:opacity-60"
          >
            {isSaving ? 'Updating Security Credentials...' : 'Save Strong Password & Unlock Prob8'}
          </button>
        </form>
      </div>
    </div>
  );
};
