import React, { useState } from 'react';
import { Bell, Check, LogOut, ShieldCheck, Sparkles, Tag, X } from 'lucide-react';
import type { PaymentProcessorId, PromoCode, UserProfile } from '../types';
import {
  PAYMENT_PROCESSORS,
  calculateCheckoutTotals,
  formatTierLabel,
  validatePromoCode,
} from '../utils/paymentAdapter';

interface AuthAndProModalProps {
  profile: UserProfile;
  activeProcessor: PaymentProcessorId;
  promoCodes?: PromoCode[];
  onUpdateProfile: (patch: Partial<UserProfile>) => void;
  onCheckoutPlan: (plan: 'pro' | 'vip_lifetime', isTrial?: boolean, promoCode?: string) => void;
  onSignOut: () => void;
  onClose: () => void;
}

const PRO_CAPABILITIES = [
  '100% Nationwide Active Probate Leads & Live County Auctions (All 50 States + DC)',
  'Prob8 Institutional Multi-Strategy Underwriting (Flip, BRRRR, Rental, Trailer Parks)',
  'Built-In Zero-Key Public Records + OSINT Skip Tracing & Auto-CRM Linking',
  '1-Click Hardware-Matched Local Ollama, Free Gemini AI, or Browser WebLLM',
  'Instant Auto-Generated Push Alerts across Desktop, iOS & Android',
  'Localized State-Specific Purchase Contracts & Custom LOIs',
  'Unlimited Pipeline CSV Export & County Filing Checklists',
];

export const AuthAndProModal: React.FC<AuthAndProModalProps> = ({
  profile,
  activeProcessor,
  promoCodes = [],
  onUpdateProfile,
  onCheckoutPlan,
  onSignOut,
  onClose,
}) => {
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | undefined>(undefined);
  const [promoFeedback, setPromoFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const processorMeta =
    PAYMENT_PROCESSORS.find((p) => p.id === activeProcessor) ?? PAYMENT_PROCESSORS[0];
  const appliedPromoCheck = appliedPromoCode
    ? validatePromoCode(appliedPromoCode, promoCodes)
    : null;
  const activeDiscountPct = appliedPromoCheck?.ok ? appliedPromoCheck.discountPct : 0;
  const effectiveTrialDays = Math.max(
    7,
    appliedPromoCheck?.ok ? appliedPromoCheck.freeTrialDays : 7
  );
  const proTotals = calculateCheckoutTotals({
    plan: 'pro',
    processor: activeProcessor,
    discountPct: activeDiscountPct,
  });
  const lifetimeTotals = calculateCheckoutTotals({
    plan: 'vip_lifetime',
    processor: activeProcessor,
    discountPct: activeDiscountPct,
  });

  const handleApplyPromo = () => {
    const check = validatePromoCode(promoInput, promoCodes);
    if (!check.ok || !check.promo) {
      setAppliedPromoCode(undefined);
      setPromoFeedback({ ok: false, text: check.reason || 'Invalid promo code.' });
      return;
    }
    setAppliedPromoCode(check.promo.code);
    setPromoInput(check.promo.code);
    const trialPart =
      check.freeTrialDays > 7 ? ` + ${check.freeTrialDays}-day extended trial` : '';
    setPromoFeedback({
      ok: true,
      text: `${check.promo.code} applied: ${check.discountPct}% off${trialPart}.`,
    });
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      fullName: fullName.trim() || 'Acquisition Partner',
    });
    setStatusMessage('Profile preferences saved.');
  };

  const handleTogglePush = async () => {
    if (profile.pushToken) {
      onUpdateProfile({ pushToken: undefined });
      setStatusMessage('Push notifications paused.');
      return;
    }
    await fetch('/api/push/public-key').catch(() => null);
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm =
        Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission().catch(() => 'default');
      if (perm === 'denied') {
        setStatusMessage('Push permission blocked in browser site settings.');
        return;
      }
    }
    onUpdateProfile({ pushToken: `web-push-${Date.now().toString(36)}` });
    setStatusMessage('Push alerts activated for Buy-Boxes & Auctions.');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Account, Membership Tiers & Push Alerts"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Prob8 Membership Tiers &amp; Account Preferences
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Current Plan:{' '}
              <span className="font-semibold uppercase text-[#0F766E] dark:text-emerald-400">
                {formatTierLabel(profile?.subscriptionTier ?? 'free')}
              </span>{' '}
              · Processor: {processorMeta.name}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close Account Modal"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          {statusMessage && (
            <div className="rounded-xl border border-[#0F766E]/25 bg-[#0F766E]/5 px-4 py-2.5 text-xs font-semibold text-[#0F766E] dark:text-emerald-400">
              {statusMessage}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pro & Lifetime Plan Comparison */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900 p-5 text-white space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-display text-base font-bold">
                  <Sparkles className="h-4 w-4 text-[#5EEAD4]" />
                  Prob8 Pro &amp; Lifetime
                </span>
                <span className="font-mono text-xs font-bold text-[#5EEAD4]">
                  $79/mo or $699 Life
                </span>
              </div>

              <ul className="space-y-2 text-xs text-slate-200">
                {PRO_CAPABILITIES.map((cap) => (
                  <li key={cap} className="flex items-start gap-2">
                    <Check className="h-4 w-4 shrink-0 text-[#5EEAD4]" />
                    <span>{cap}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-2 space-y-2.5">
                {profile.subscriptionTier !== 'vip_lifetime' && (
                  <div className="rounded-xl border border-white/15 bg-white/5 p-2.5 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-[#5EEAD4] shrink-0" />
                      <input
                        type="text"
                        aria-label="Promo code"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        placeholder="Promo code (optional)"
                        className="flex-1 min-w-0 h-8 rounded-lg border border-white/15 bg-slate-950/60 px-2.5 font-mono text-xs uppercase text-white placeholder:text-slate-400"
                      />
                      {appliedPromoCode ? (
                        <button
                          type="button"
                          onClick={() => {
                            setAppliedPromoCode(undefined);
                            setPromoInput('');
                            setPromoFeedback(null);
                          }}
                          className="h-8 rounded-lg border border-white/20 px-2.5 text-[11px] font-semibold text-slate-200 hover:bg-white/10"
                        >
                          Clear
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleApplyPromo}
                          className="h-8 rounded-lg bg-[#0F766E] px-3 text-[11px] font-semibold text-white hover:bg-[#0D625B]"
                        >
                          Apply
                        </button>
                      )}
                    </div>
                    {promoFeedback && (
                      <p
                        className={`text-[11px] font-medium ${
                          promoFeedback.ok ? 'text-[#5EEAD4]' : 'text-amber-300'
                        }`}
                      >
                        {promoFeedback.text}
                      </p>
                    )}
                  </div>
                )}

                {profile.subscriptionTier === 'vip_lifetime' ? (
                  <p className="w-full text-center text-xs font-semibold text-indigo-300 py-2">
                    Prob8 Lifetime Active ($0/mo Forever)
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {profile.subscriptionTier === 'free' && (
                        <button
                          type="button"
                          onClick={() => {
                            onCheckoutPlan('pro', true, appliedPromoCode);
                            setStatusMessage(
                              `${effectiveTrialDays}-Day Free Trial of Prob8 Pro activated across all 3,143 US counties.`
                            );
                          }}
                          className="flex-1 h-10 rounded-xl bg-[#0F766E] px-3 text-xs font-semibold text-white hover:bg-[#0D625B]"
                        >
                          {effectiveTrialDays}-Day Free Trial
                        </button>
                      )}
                      {profile.subscriptionTier === 'free' && (
                        <button
                          type="button"
                          onClick={() => {
                            onCheckoutPlan('pro', false, appliedPromoCode);
                            setStatusMessage(
                              `Prob8 Pro ($${proTotals.grossUsd}/mo) activated via ${processorMeta.name}.`
                            );
                          }}
                          className="flex-1 h-10 rounded-xl border border-white/25 px-3 text-xs font-semibold text-white hover:bg-white/10"
                        >
                          Pro (${proTotals.grossUsd}/mo)
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onCheckoutPlan('vip_lifetime', false, appliedPromoCode);
                        setStatusMessage(
                          `Prob8 Lifetime ($${lifetimeTotals.grossUsd} One-Time) unlocked permanently via ${processorMeta.name}.`
                        );
                      }}
                      className="w-full h-10 rounded-xl bg-indigo-600 px-3 text-xs font-bold text-white hover:bg-indigo-500"
                    >
                      Unlock Prob8 Lifetime (${lifetimeTotals.grossUsd} One-Time)
                    </button>
                    {profile.subscriptionTier === 'pro' && !profile.isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateProfile({ subscriptionTier: 'free', trialEndsAt: undefined });
                          setStatusMessage('Subscription paused. Switched cleanly to Free Tier ($0/mo).');
                        }}
                        className="w-full h-9 rounded-xl border border-white/20 text-xs font-semibold text-white hover:bg-white/10"
                      >
                        Pause / Switch to Free Tier
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Investor Preferences & Auto-VAPID Push */}
            <div className="space-y-5">
              <form onSubmit={handleSavePreferences} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Investor Account &amp; Push Alerts
                </h3>
                <div>
                  <label htmlFor="prof-name" className="block text-xs text-slate-600 dark:text-slate-400">
                    Investor / Entity Name
                  </label>
                  <input
                    id="prof-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Signed in as <span className="font-mono font-semibold">{profile.email}</span> · Referral Code{' '}
                  <span className="font-mono font-semibold text-[#0F766E] dark:text-emerald-400">{profile.affiliateCode}</span>
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="submit"
                    className="h-9 rounded-lg bg-slate-900 dark:bg-emerald-600 px-3.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Save Name
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleTogglePush()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Bell className="h-3.5 w-3.5 text-[#0F766E] dark:text-emerald-400" />
                    {profile.pushToken ? 'Push Alerts: On' : 'Push Alerts: Off'}
                  </button>
                </div>
              </form>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-4 text-xs text-slate-600 dark:text-slate-300 space-y-3">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-[#0F766E] dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p>
                    Zero-Data-Harvesting Guarantee: Your Pipeline, CRM, Portfolio, and AI keys stay strictly isolated inside your Prob8 workspace.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSignOut();
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-900 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out of Prob8
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
