import type {
  AffiliateReferral,
  LedgerTransaction,
  PaymentProcessorId,
  PromoCode,
  SubscriptionTier,
} from '../types';

export interface ProcessorMeta {
  id: PaymentProcessorId;
  name: string;
  typeLabel: 'Merchant of Record' | 'Direct Merchant Processor' | 'Wallet & Card';
  feePct: number;
  feeFixedUsd: number;
  freezeRiskNote: string;
}

export const PAYMENT_PROCESSORS: ProcessorMeta[] = [
  {
    id: 'lemonsqueezy',
    name: 'Lemon Squeezy',
    typeLabel: 'Merchant of Record',
    feePct: 0.05,
    feeFixedUsd: 0.5,
    freezeRiskNote: 'Handles global SaaS sales tax/VAT automatically with predictable SaaS payouts.',
  },
  {
    id: 'paddle',
    name: 'Paddle',
    typeLabel: 'Merchant of Record',
    feePct: 0.05,
    feeFixedUsd: 0.5,
    freezeRiskNote: 'Enterprise SaaS Merchant of Record covering tax remittance & chargeback defense.',
  },
  {
    id: 'square',
    name: 'Square',
    typeLabel: 'Direct Merchant Processor',
    feePct: 0.029,
    feeFixedUsd: 0.3,
    freezeRiskNote: 'Direct merchant processing with instant card/ACH settlement.',
  },
  {
    id: 'authorizenet',
    name: 'Authorize.Net',
    typeLabel: 'Direct Merchant Processor',
    feePct: 0.029,
    feeFixedUsd: 0.3,
    freezeRiskNote: 'Bank-underwritten dedicated merchant gateway ideal for high-ticket $699 Lifetime licenses.',
  },
  {
    id: 'paypal',
    name: 'PayPal Commerce',
    typeLabel: 'Wallet & Card',
    feePct: 0.0349,
    feeFixedUsd: 0.49,
    freezeRiskNote: 'Global buyer wallet + Venmo + guest card checkout.',
  },
];

export const PRO_MONTHLY_USD = 79;
export const LIFETIME_ONE_TIME_USD = 699;
export const AFFILIATE_PRO_RECURRING_PCT = 30;
export const AFFILIATE_LIFETIME_FLAT_USD = 150;
export const AFFILIATE_COOKIE_DAYS = 60;
export const AFFILIATE_MIN_PAYOUT_USD = 50;

export function formatTierLabel(tier: SubscriptionTier): string {
  if (tier === 'vip_lifetime') return 'Prob8 Lifetime ($699)';
  if (tier === 'pro') return 'Prob8 Pro ($79/mo)';
  return 'Free Tier ($0/mo)';
}

export function calculateCheckoutTotals(params: {
  plan: 'pro' | 'vip_lifetime';
  processor: PaymentProcessorId;
  discountPct?: number;
  isTrial?: boolean;
}): { grossUsd: number; feeUsd: number; netUsd: number } {
  if (params.isTrial) {
    return { grossUsd: 0, feeUsd: 0, netUsd: 0 };
  }
  const base = params.plan === 'vip_lifetime' ? LIFETIME_ONE_TIME_USD : PRO_MONTHLY_USD;
  const pct = Math.max(0, Math.min(100, params.discountPct ?? 0));
  const grossUsd = Number((base * (1 - pct / 100)).toFixed(2));
  if (grossUsd <= 0) {
    return { grossUsd: 0, feeUsd: 0, netUsd: 0 };
  }
  const meta = PAYMENT_PROCESSORS.find((p) => p.id === params.processor) ?? PAYMENT_PROCESSORS[0];
  const feeUsd = Number((grossUsd * meta.feePct + meta.feeFixedUsd).toFixed(2));
  const netUsd = Number(Math.max(0, grossUsd - feeUsd).toFixed(2));
  return { grossUsd, feeUsd, netUsd };
}

export interface PromoValidationResult {
  ok: boolean;
  promo?: PromoCode;
  discountPct: number;
  freeTrialDays: number;
  reason?: string;
}

export function validatePromoCode(
  rawCode: string,
  promoCodes: PromoCode[],
  now: Date = new Date()
): PromoValidationResult {
  const normalized = (rawCode || '').trim().toUpperCase();
  if (!normalized) {
    return { ok: false, discountPct: 0, freeTrialDays: 0, reason: 'Enter a promo code first.' };
  }
  const match = promoCodes.find((p) => p.code.trim().toUpperCase() === normalized);
  if (!match) {
    return {
      ok: false,
      discountPct: 0,
      freeTrialDays: 0,
      reason: `Promo code "${normalized}" was not found.`,
    };
  }
  if (!match.isActive) {
    return {
      ok: false,
      discountPct: 0,
      freeTrialDays: 0,
      reason: `Promo code "${match.code}" is currently paused.`,
    };
  }
  if (match.usageLimit > 0 && match.timesUsed >= match.usageLimit) {
    return {
      ok: false,
      discountPct: 0,
      freeTrialDays: 0,
      reason: `Promo code "${match.code}" has reached its redemption limit.`,
    };
  }
  if (match.expiresAt) {
    const expiryIso = match.expiresAt.includes('T')
      ? match.expiresAt
      : `${match.expiresAt}T23:59:59.999Z`;
    const expiryTime = Date.parse(expiryIso);
    if (Number.isFinite(expiryTime) && now.getTime() > expiryTime) {
      return {
        ok: false,
        discountPct: 0,
        freeTrialDays: 0,
        reason: `Promo code "${match.code}" expired on ${match.expiresAt.slice(0, 10)}.`,
      };
    }
  }
  return {
    ok: true,
    promo: match,
    discountPct: Math.max(0, Math.min(100, match.discountPct || 0)),
    freeTrialDays: Math.max(0, match.freeTrialDays || 0),
  };
}

export function calculateAffiliateCommission(
  activeProConversions: number,
  lifetimeConversions: number
): { monthlyRecurringUsd: number; lifetimeFlatUsd: number; totalCommissionUsd: number } {
  const monthlyRecurringUsd = Number(
    (activeProConversions * PRO_MONTHLY_USD * (AFFILIATE_PRO_RECURRING_PCT / 100)).toFixed(2)
  );
  const lifetimeFlatUsd = Number((lifetimeConversions * AFFILIATE_LIFETIME_FLAT_USD).toFixed(2));
  return {
    monthlyRecurringUsd,
    lifetimeFlatUsd,
    totalCommissionUsd: Number((monthlyRecurringUsd + lifetimeFlatUsd).toFixed(2)),
  };
}

export function isEligibleForAffiliatePayout(aff: Pick<AffiliateReferral, 'commissionsOwedUsd'>): boolean {
  return aff.commissionsOwedUsd >= AFFILIATE_MIN_PAYOUT_USD;
}

export function exportLedgerToCsv(rows: LedgerTransaction[]): string {
  const headers = [
    'Transaction ID',
    'Date',
    'User Email',
    'Plan',
    'Processor',
    'Promo Code',
    'Gross (USD)',
    'Fees (USD)',
    'Net (USD)',
    'Status',
    'Affiliate Code',
  ];
  const escape = (val: unknown) => {
    const s = String(val ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const body = rows.map((r) =>
    [
      r.id,
      r.date.slice(0, 10),
      r.userEmail,
      r.plan,
      r.processor,
      r.promoCode ?? '',
      r.grossUsd.toFixed(2),
      r.feeUsd.toFixed(2),
      r.netUsd.toFixed(2),
      r.status,
      r.affiliateCode ?? '',
    ]
      .map(escape)
      .join(',')
  );
  return [headers.join(','), ...body].join('\n');
}

export function exportLedgerToAccountingJson(rows: LedgerTransaction[], format: 'quickbooks' | 'xero'): string {
  const entries = rows.map((r) => ({
    externalSystem: format === 'quickbooks' ? 'QuickBooks Online' : 'Xero Accounting',
    txnDate: r.date.slice(0, 10),
    docNumber: r.id,
    customerEmail: r.userEmail,
    lineItem: r.plan,
    paymentProcessor: r.processor,
    grossAmount: r.grossUsd,
    processorFee: r.feeUsd,
    netDeposit: r.netUsd,
    status: r.status,
  }));
  return JSON.stringify({ exportedAt: new Date().toISOString(), format, entries }, null, 2);
}

export function buildStateLocalizedAffiliateAgreement(params: {
  partnerName: string;
  stateOfResidence: string;
  referralCode: string;
}): string {
  const state = (params.stateOfResidence || 'United States').trim().toUpperCase();
  const partner = params.partnerName.trim() || 'Affiliate Partner';
  return `PROB8 INDEPENDENT AFFILIATE PARTNER AGREEMENT (${state} JURISDICTION)

1. PARTIES & INDEPENDENT CONTRACTOR STATUS
This Affiliate Partner Agreement ("Agreement") is entered into between Prob8 ("Company") and ${partner} ("Affiliate"), residing in the State of ${state}, under referral code ${params.referralCode}. Affiliate operates strictly as an independent contractor and not an employee, broker, or legal agent of Prob8.

2. AFFILIATE PAY PLAN & ATTRIBUTION
- Recurring Pro Commission: ${AFFILIATE_PRO_RECURRING_PCT}% recurring monthly ($23.70/mo) on active Prob8 Pro ($${PRO_MONTHLY_USD}/mo) referrals.
- Lifetime License Commission: $${LIFETIME_ONE_TIME_USD === 699 ? AFFILIATE_LIFETIME_FLAT_USD : 150} one-time flat commission per referred Prob8 Lifetime ($${LIFETIME_ONE_TIME_USD}) license.
- Attribution Window: ${AFFILIATE_COOKIE_DAYS}-day first/last-touch referral cookie via https://prob8.app/?ref=${params.referralCode}.
- Payout Schedule & Threshold: Monthly payouts via PayPal or ACH Bank Transfer once accrued payable balance reaches $${AFFILIATE_MIN_PAYOUT_USD}.00 minimum. Self-referrals and fraudulent/refunded transactions are excluded.

3. STATE-SPECIFIC GOVERNING LAW (${state})
This Agreement is governed by applicable federal statutes and the commercial contract, independent contractor, and consumer protection laws of the State of ${state}. Affiliate represents that Affiliate holds any local business permit required in ${state} for digital marketing activities and does not engage in unlicensed real estate brokerage.

4. FTC 16 CFR PART 255 & ANTI-SPAM COMPLIANCE
Affiliate must clearly and conspicuously disclose material connections ("I may earn a commission if you subscribe to Prob8 via my link") on every blog, video, email, or social promotion, and comply with CAN-SPAM and TCPA rules.`;
}

export interface ReferralAttribution {
  refCode?: string;
  lemonSqueezyAffId?: string;
}

export function extractReferralParams(search: string): ReferralAttribution {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const rawRef = params.get('ref')?.trim();
  const rawAff = params.get('aff')?.trim();
  return {
    refCode: rawRef ? rawRef.toUpperCase() : undefined,
    lemonSqueezyAffId: rawAff || undefined,
  };
}

export function getLemonSqueezyAffiliateId(win?: unknown): string | undefined {
  const target = (win ?? (typeof window !== 'undefined' ? window : undefined)) as
    | { LemonSqueezy?: { Affiliate?: { GetId?: () => unknown } } }
    | undefined;
  try {
    const id = target?.LemonSqueezy?.Affiliate?.GetId?.();
    if (typeof id === 'string' && id.trim()) return id.trim();
    if (typeof id === 'number' && Number.isFinite(id)) return String(id);
  } catch {
    // ignore if LemonSqueezy affiliate script has not initialized
  }
  return undefined;
}

