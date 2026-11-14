import test from 'node:test';
import assert from 'node:assert/strict';
import type { PropertyRecord } from '../types.ts';
import { applyFreemiumResultGating } from './resultGating.ts';

function makeProp(id: string): PropertyRecord {
  return { id } as PropertyRecord;
}

test('applyFreemiumResultGating caps free tier at 5 per county and unlocks 100% for Pro/VIP', () => {
  const sample = Array.from({ length: 12 }, (_, i) => makeProp(`p-${i}`));

  const freeCounty = applyFreemiumResultGating(sample, 'free', false, 312, 142850);
  assert.equal(freeCounty.unlocked.length, 5);
  assert.equal(freeCounty.lockedCount, 307);
  assert.equal(freeCounty.isGated, true);

  const freeNational = applyFreemiumResultGating(sample, 'free', true, 312, 142850);
  assert.equal(freeNational.unlocked.length, 10);
  assert.equal(freeNational.lockedCount, 142840);
  assert.equal(freeNational.isGated, true);

  const vip = applyFreemiumResultGating(sample, 'vip_lifetime', false, 312, 142850);
  assert.equal(vip.unlocked.length, 12);
  assert.equal(vip.lockedCount, 0);
  assert.equal(vip.isGated, false);
});
