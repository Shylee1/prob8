import test from 'node:test';
import assert from 'node:assert/strict';
import { getProbateUrgencyBadge } from './probateTiming.ts';

test('getProbateUrgencyBadge classifies <14 days, 21-45 days, 90+ days, and auctions', () => {
  const ref = new Date('2026-11-14T12:00:00Z');

  assert.equal(getProbateUrgencyBadge('2026-11-05', 'active', ref).label, 'Filed <14 Days Ago');
  assert.equal(
    getProbateUrgencyBadge('2026-10-15', 'active', ref).label,
    'Prime Outreach Window: 21-45 Days'
  );
  assert.equal(getProbateUrgencyBadge('2026-07-01', 'active', ref).label, 'Motivated: 90+ Days');
  assert.equal(
    getProbateUrgencyBadge('2026-11-01', 'auction', ref).label,
    'Live Auction Scheduled'
  );
});
