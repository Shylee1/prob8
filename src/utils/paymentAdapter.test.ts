import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStateLocalizedAffiliateAgreement,
  calculateAffiliateCommission,
  calculateCheckoutTotals,
  exportLedgerToCsv,
  formatTierLabel,
  isEligibleForAffiliatePayout,
  validatePromoCode,
} from './paymentAdapter';

test('formatTierLabel returns unified clear tier names without VIP confusion', () => {
  assert.equal(formatTierLabel('free'), 'Free Tier ($0/mo)');
  assert.equal(formatTierLabel('pro'), 'Prob8 Pro ($79/mo)');
  assert.equal(formatTierLabel('vip_lifetime'), 'Prob8 Lifetime ($699)');
});

test('calculateCheckoutTotals calculates $79 Pro and $699 Lifetime via Lemon Squeezy and trials at $0', () => {
  const pro = calculateCheckoutTotals({ plan: 'pro', processor: 'lemonsqueezy' });
  assert.equal(pro.grossUsd, 79);
  assert.equal(pro.feeUsd, 4.45);
  assert.equal(pro.netUsd, 74.55);

  const lifetime = calculateCheckoutTotals({ plan: 'vip_lifetime', processor: 'square', discountPct: 10 });
  assert.equal(lifetime.grossUsd, 629.1);
  assert.ok(lifetime.netUsd > 600);

  const trial = calculateCheckoutTotals({ plan: 'pro', processor: 'paddle', isTrial: true });
  assert.equal(trial.grossUsd, 0);
  assert.equal(trial.netUsd, 0);
});

test('calculateAffiliateCommission applies 30% recurring Pro and $150 flat Lifetime math', () => {
  const res = calculateAffiliateCommission(4, 2);
  assert.equal(res.monthlyRecurringUsd, 94.8);
  assert.equal(res.lifetimeFlatUsd, 300);
  assert.equal(res.totalCommissionUsd, 394.8);

  assert.equal(isEligibleForAffiliatePayout({ commissionsOwedUsd: 49.99 }), false);
  assert.equal(isEligibleForAffiliatePayout({ commissionsOwedUsd: 50 }), true);
});

test('buildStateLocalizedAffiliateAgreement embeds state jurisdiction and 30%/$150 terms', () => {
  const doc = buildStateLocalizedAffiliateAgreement({
    partnerName: 'Jordan Vance',
    stateOfResidence: 'TX',
    referralCode: 'JORDAN30',
  });
  assert.match(doc, /TX JURISDICTION/);
  assert.match(doc, /30% recurring/);
  assert.match(doc, /\$150/);
  assert.match(doc, /60-day/);
});

test('exportLedgerToCsv generates valid CSV header and rows', () => {
  const csv = exportLedgerToCsv([
    {
      id: 'txn-1',
      date: '2026-11-14T10:00:00.000Z',
      userId: 'u-1',
      userEmail: 'buyer@example.com',
      plan: 'Prob8 Lifetime ($699)',
      processor: 'lemonsqueezy',
      grossUsd: 699,
      feeUsd: 35.45,
      netUsd: 663.55,
      status: 'paid',
    },
  ]);
  assert.match(csv, /Transaction ID,Date,User Email/);
  assert.match(csv, /txn-1,2026-11-14,buyer@example\.com,Prob8 Lifetime \(\$699\),lemonsqueezy,,699\.00,35\.45,663\.55,paid,/);
});

test('validatePromoCode validates active, paused, exhausted, expired, and unknown codes', () => {
  const promos = [
    {
      id: 'p1',
      code: 'PROBATE50',
      discountPct: 50,
      freeTrialDays: 14,
      expiresAt: '2027-12-31',
      usageLimit: 10,
      timesUsed: 2,
      isActive: true,
    },
    {
      id: 'p2',
      code: 'PAUSED20',
      discountPct: 20,
      freeTrialDays: 7,
      expiresAt: '2027-12-31',
      usageLimit: 10,
      timesUsed: 0,
      isActive: false,
    },
    {
      id: 'p3',
      code: 'MAXEDOUT',
      discountPct: 25,
      freeTrialDays: 7,
      expiresAt: '2027-12-31',
      usageLimit: 5,
      timesUsed: 5,
      isActive: true,
    },
    {
      id: 'p4',
      code: 'EXPIRED10',
      discountPct: 10,
      freeTrialDays: 7,
      expiresAt: '2025-01-01',
      usageLimit: 10,
      timesUsed: 0,
      isActive: true,
    },
  ];
  const refDate = new Date('2026-11-14T12:00:00Z');

  const okRes = validatePromoCode(' probate50 ', promos, refDate);
  assert.equal(okRes.ok, true);
  assert.equal(okRes.discountPct, 50);
  assert.equal(okRes.freeTrialDays, 14);
  assert.equal(okRes.promo?.code, 'PROBATE50');

  assert.equal(validatePromoCode('PAUSED20', promos, refDate).ok, false);
  assert.equal(validatePromoCode('MAXEDOUT', promos, refDate).ok, false);
  assert.equal(validatePromoCode('EXPIRED10', promos, refDate).ok, false);
  assert.equal(validatePromoCode('DOESNOTEXIST', promos, refDate).ok, false);
});

