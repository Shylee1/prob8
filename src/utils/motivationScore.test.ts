import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMotivationScore } from './motivationScore.ts';

test('calculateMotivationScore ranks stacked distress leads higher than baseline', () => {
  const ref = new Date('2026-11-14T12:00:00Z');
  const hot = calculateMotivationScore(
    {
      filingDate: '2026-07-01',
      status: 'auction',
      equityPct: 78,
      taxDelinquent: true,
      isVacant: true,
      preForeclosureOverlap: true,
      probateAttorney: 'Pro Se Personal Representative',
    },
    ref
  );
  assert.ok(hot.score >= 90);
  assert.equal(hot.tier, 'Hot');
  assert.ok(hot.factors.includes('Tax Delinquent'));

  const standard = calculateMotivationScore(
    {
      filingDate: '2026-11-10',
      status: 'active',
      equityPct: 20,
      taxDelinquent: false,
      isVacant: false,
      preForeclosureOverlap: false,
      probateAttorney: 'Vance LLP',
    },
    ref
  );
  assert.ok(standard.score < 50);
  assert.equal(standard.tier, 'Standard');
});
