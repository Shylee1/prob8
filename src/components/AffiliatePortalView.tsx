import React, { useMemo, useState } from 'react';
import {
  Award,
  Check,
  CheckCircle2,
  Copy,
  DollarSign,
  FileSignature,
  Link2,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import type { AffiliateReferral } from '../types';
import {
  AFFILIATE_COOKIE_DAYS,
  AFFILIATE_LIFETIME_FLAT_USD,
  AFFILIATE_MIN_PAYOUT_USD,
  AFFILIATE_PRO_RECURRING_PCT,
  buildStateLocalizedAffiliateAgreement,
  calculateAffiliateCommission,
  isEligibleForAffiliatePayout,
} from '../utils/paymentAdapter';
import { formatCurrency, formatDateShort } from '../utils/formatters';

interface AffiliatePortalViewProps {
  currentUserEmail?: string;
  currentUserName?: string;
  affiliates: AffiliateReferral[];
  onRegisterAffiliate: (
    payload: Omit<
      AffiliateReferral,
      | 'id'
      | 'clicks'
      | 'signups'
      | 'activeProConversions'
      | 'lifetimeConversions'
      | 'commissionRatePct'
      | 'lifetimeFlatCommissionUsd'
      | 'commissionsOwedUsd'
      | 'monthlyPayoutUsd'
      | 'totalPaidUsd'
      | 'payoutHistory'
    >
  ) => void;
  onBack?: () => void;
}

const US_JURISDICTIONS = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'INTL',
];

export const AffiliatePortalView: React.FC<AffiliatePortalViewProps> = ({
  currentUserEmail,
  currentUserName,
  affiliates,
  onRegisterAffiliate,
  onBack,
}) => {
  const existingPartner = useMemo(() => {
    if (!currentUserEmail) return null;
    return (
      affiliates.find(
        (a) => a.partnerEmail.toLowerCase() === currentUserEmail.trim().toLowerCase()
      ) ?? null
    );
  }, [affiliates, currentUserEmail]);

  const [partnerName, setPartnerName] = useState(currentUserName || '');
  const [partnerEmail, setPartnerEmail] = useState(currentUserEmail || '');
  const [stateOfResidence, setStateOfResidence] = useState('OH');
  const [referralCode, setReferralCode] = useState(() => {
    const clean = (currentUserName || currentUserEmail || 'PARTNER')
      .split('@')[0]
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 7);
    return `${clean || 'PROB8'}${Math.floor(10 + Math.random() * 89)}`;
  });
  const [payoutMethod, setPayoutMethod] = useState<'PayPal' | 'ACH Bank Transfer'>('PayPal');
  const [payoutDestination, setPayoutDestination] = useState(currentUserEmail || '');
  const [taxFormType, setTaxFormType] = useState<'W-9' | 'W-8BEN'>('W-9');
  const [signedStateAgreement, setSignedStateAgreement] = useState(false);
  const [signedFtcDisclosure, setSignedFtcDisclosure] = useState(false);
  const [signedTaxForm, setSignedTaxForm] = useState(false);
  const [signedFullName, setSignedFullName] = useState(currentUserName || '');
  const [formError, setFormError] = useState<string | null>(null);
  const [justSubmittedCode, setJustSubmittedCode] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const agreementPreview = useMemo(
    () =>
      buildStateLocalizedAffiliateAgreement({
        partnerName: partnerName || 'Applicant',
        stateOfResidence,
        referralCode: referralCode.toUpperCase() || 'PROB8PARTNER',
      }),
    [partnerName, stateOfResidence, referralCode]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleanEmail = partnerEmail.trim().toLowerCase();
    const cleanCode = referralCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');

    if (!partnerName.trim() || !cleanEmail || !cleanCode || !payoutDestination.trim()) {
      setFormError('Complete your name, email, referral code, and payout destination.');
      return;
    }
    if (affiliates.some((a) => a.referralCode.toUpperCase() === cleanCode)) {
      setFormError(`Referral code "${cleanCode}" is already claimed. Pick another code.`);
      return;
    }
    if (!signedStateAgreement || !signedFtcDisclosure || !signedTaxForm) {
      setFormError(
        'Check all three compliance certifications (State Partner Agreement, FTC 16 CFR Part 255 Disclosure, and Tax Form W-9/W-8BEN).'
      );
      return;
    }
    if (signedFullName.trim().length < 3) {
      setFormError('Type your full legal name as your electronic signature.');
      return;
    }

    onRegisterAffiliate({
      partnerName: partnerName.trim(),
      partnerEmail: cleanEmail,
      stateOfResidence,
      payoutMethod,
      payoutDestination: payoutDestination.trim(),
      taxFormType,
      signedFullName: signedFullName.trim(),
      signedStateAgreement: true,
      signedFtcDisclosure: true,
      signedTaxForm: true,
      signedAt: new Date().toISOString(),
      referralCode: cleanCode,
    });
    setJustSubmittedCode(cleanCode);
  };

  const activePartner =
    existingPartner ??
    (justSubmittedCode
      ? affiliates.find((a) => a.referralCode === justSubmittedCode) ?? null
      : null);

  return (
    <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="h-6 w-6 text-[#0F766E] dark:text-emerald-400" />
            Prob8 Partner &amp; Affiliate Program
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Earn {AFFILIATE_PRO_RECURRING_PCT}% recurring monthly on Prob8 Pro ($23.70/mo) plus $
            {AFFILIATE_LIFETIME_FLAT_USD} flat on every $699 Lifetime license.
          </p>
        </div>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] px-4 text-xs font-semibold text-slate-800 dark:text-white"
          >
            Back
          </button>
        )}
      </div>

      {/* Pay Plan Summary Banner */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-emerald-500/25 bg-white dark:bg-[#111827] p-4 space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-[#0F766E] dark:text-emerald-400" />
            Prob8 Pro ($79/mo)
          </p>
          <p className="font-mono text-2xl font-bold text-[#0F766E] dark:text-emerald-400">
            30% Recurring
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            $23.70 every month per active Pro subscriber
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-500/25 bg-white dark:bg-[#111827] p-4 space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-indigo-500" />
            Prob8 Lifetime ($699)
          </p>
          <p className="font-mono text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            ${AFFILIATE_LIFETIME_FLAT_USD} Flat
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Instant flat commission per Lifetime license
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Attribution Window</p>
          <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
            {AFFILIATE_COOKIE_DAYS} Days
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            First/last-touch referral tracking via ?ref=CODE
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Monthly Payouts</p>
          <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
            ${AFFILIATE_MIN_PAYOUT_USD} Min
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Paid monthly via PayPal or ACH Bank Transfer
          </p>
        </div>
      </section>

      {activePartner ? (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                Active Affiliate Partner · {activePartner.stateOfResidence} Jurisdiction
              </span>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                {activePartner.partnerName} ({activePartner.referralCode})
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 font-mono text-xs text-slate-800 dark:text-slate-200">
                https://prob8.app/?ref={activePartner.referralCode}
              </code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(
                    `https://prob8.app/?ref=${activePartner.referralCode}`
                  );
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2500);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0F766E] px-3.5 text-xs font-semibold text-white"
              >
                {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedLink ? 'Copied Link' : 'Copy Referral Link'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Link Clicks</p>
              <p className="font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                {activePartner.clicks}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Signups</p>
              <p className="font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                {activePartner.signups}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Pro / Lifetime Sales</p>
              <p className="font-mono text-xl font-bold text-[#0F766E] dark:text-emerald-400 tabular-nums">
                {activePartner.activeProConversions} / {activePartner.lifetimeConversions}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Commissions Owed</p>
              <p className="font-mono text-xl font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                {formatCurrency(activePartner.commissionsOwedUsd)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Paid Out</p>
              <p className="font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                {formatCurrency(activePartner.totalPaidUsd)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Tax &amp; Compliance Record
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                <strong>Signed Legal Name:</strong> {activePartner.signedFullName} ·{' '}
                <strong>Signed:</strong> {formatDateShort(activePartner.signedAt)}
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                <strong>Payout Route:</strong> {activePartner.payoutMethod} ({activePartner.payoutDestination}) ·{' '}
                <strong>Tax Form:</strong> {activePartner.taxFormType} On File
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                <strong>Next Payout Eligibility:</strong>{' '}
                {isEligibleForAffiliatePayout(activePartner)
                  ? 'Eligible for current monthly batch ($50+ met)'
                  : `Accruing toward $${AFFILIATE_MIN_PAYOUT_USD} minimum`}
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                <strong>Est. Commission Projection:</strong>{' '}
                {formatCurrency(
                  calculateAffiliateCommission(
                    activePartner.activeProConversions,
                    activePartner.lifetimeConversions
                  ).totalCommissionUsd
                )}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Payout History ({activePartner.payoutHistory.length})
              </h3>
              {activePartner.payoutHistory.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400">
                  No payouts issued yet. Commissions release monthly once balance hits ${AFFILIATE_MIN_PAYOUT_USD}.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activePartner.payoutHistory.map((p) => (
                    <li key={p.id} className="py-1.5 flex items-center justify-between">
                      <span>
                        {formatDateShort(p.paidAt)} · {p.method} ({p.referenceNote})
                      </span>
                      <span className="font-mono font-bold text-[#0F766E] dark:text-emerald-400">
                        {formatCurrency(p.amountUsd)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6"
        >
          <div className="lg:col-span-6 space-y-4">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Link2 className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />
              Affiliate Registration &amp; Payout Setup
            </h2>

            {formError && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label htmlFor="aff-reg-name" className="block font-semibold text-slate-700 dark:text-slate-300">
                  Full Legal / Business Name
                </label>
                <input
                  id="aff-reg-name"
                  type="text"
                  required
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="Jordan Rivera / Capital Media LLC"
                  className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3"
                />
              </div>

              <div>
                <label htmlFor="aff-reg-email" className="block font-semibold text-slate-700 dark:text-slate-300">
                  Partner Email
                </label>
                <input
                  id="aff-reg-email"
                  type="email"
                  required
                  value={partnerEmail}
                  onChange={(e) => setPartnerEmail(e.target.value)}
                  placeholder="partner@domain.com"
                  className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 font-mono"
                />
              </div>

              <div>
                <label htmlFor="aff-reg-state" className="block font-semibold text-slate-700 dark:text-slate-300">
                  State / Jurisdiction of Residence
                </label>
                <select
                  id="aff-reg-state"
                  value={stateOfResidence}
                  onChange={(e) => setStateOfResidence(e.target.value)}
                  className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 font-semibold"
                >
                  {US_JURISDICTIONS.map((st) => (
                    <option key={st} value={st}>
                      {st === 'INTL' ? 'International (Non-US)' : st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="aff-reg-code" className="block font-semibold text-slate-700 dark:text-slate-300">
                  Custom Referral Code
                </label>
                <input
                  id="aff-reg-code"
                  type="text"
                  required
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 font-mono uppercase"
                />
              </div>

              <div>
                <label htmlFor="aff-payout-method" className="block font-semibold text-slate-700 dark:text-slate-300">
                  Monthly Payout Method
                </label>
                <select
                  id="aff-payout-method"
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value as 'PayPal' | 'ACH Bank Transfer')}
                  className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 font-semibold"
                >
                  <option value="PayPal">PayPal</option>
                  <option value="ACH Bank Transfer">ACH Bank Transfer</option>
                </select>
              </div>

              <div>
                <label htmlFor="aff-payout-dest" className="block font-semibold text-slate-700 dark:text-slate-300">
                  {payoutMethod === 'PayPal' ? 'PayPal Email' : 'ACH Routing / Account Label'}
                </label>
                <input
                  id="aff-payout-dest"
                  type="text"
                  required
                  value={payoutDestination}
                  onChange={(e) => setPayoutDestination(e.target.value)}
                  placeholder={payoutMethod === 'PayPal' ? 'payout@domain.com' : 'Bank · Last 4 digits'}
                  className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="aff-tax-form" className="block font-semibold text-slate-700 dark:text-slate-300">
                  IRS / Tax Form Classification
                </label>
                <select
                  id="aff-tax-form"
                  value={taxFormType}
                  onChange={(e) => setTaxFormType(e.target.value as 'W-9' | 'W-8BEN')}
                  className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 font-semibold"
                >
                  <option value="W-9">IRS Form W-9 (US Resident / US LLC)</option>
                  <option value="W-8BEN">IRS Form W-8BEN (Non-US Foreign Partner)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2.5 pt-2 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={signedStateAgreement}
                  onChange={(e) => setSignedStateAgreement(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#0F766E]"
                />
                <span className="text-slate-700 dark:text-slate-300">
                  I agree to the{' '}
                  <strong>{stateOfResidence}-Localized Affiliate Partner Agreement</strong> shown on the right.
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={signedFtcDisclosure}
                  onChange={(e) => setSignedFtcDisclosure(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#0F766E]"
                />
                <span className="text-slate-700 dark:text-slate-300">
                  I certify compliance with <strong>FTC 16 CFR Part 255 Endorsement Guides</strong> and CAN-SPAM disclosure rules on all promotional links.
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={signedTaxForm}
                  onChange={(e) => setSignedTaxForm(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#0F766E]"
                />
                <span className="text-slate-700 dark:text-slate-300">
                  I certify under penalty of perjury that my selected <strong>{taxFormType}</strong> taxpayer classification is accurate for 1099/payout reporting.
                </span>
              </label>
            </div>

            <div className="pt-1">
              <label htmlFor="aff-esign" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Electronic Digital Signature (Type Full Legal Name)
              </label>
              <input
                id="aff-esign"
                type="text"
                required
                value={signedFullName}
                onChange={(e) => setSignedFullName(e.target.value)}
                placeholder="Type Full Legal Name to Sign"
                className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 font-serif italic text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full h-11 rounded-xl bg-[#0F766E] text-sm font-semibold text-white hover:bg-[#0D625B] inline-flex items-center justify-center gap-2"
            >
              <FileSignature className="h-4 w-4" />
              Sign Agreement &amp; Activate Affiliate Link
            </button>
          </div>

          <div className="lg:col-span-6 flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-indigo-500" />
                Live {stateOfResidence}-Localized Partner Agreement
              </h3>
              <pre className="h-[420px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-4 font-mono text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                {agreementPreview}
              </pre>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Upon digital signature, your partner record, timestamped {stateOfResidence} agreement, and referral code sync directly to the Founder Affiliate Dossier Inspector.
            </p>
          </div>
        </form>
      )}
    </div>
  );
};
