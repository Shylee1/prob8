import test from 'node:test';
import assert from 'node:assert/strict';
import type { PropertyRecord } from '../types.ts';
import { FREE_RESULTS_PER_COUNTY, applyFreemiumResultGating } from './resultGating.ts';

function makeProp(id: string, county = 'Franklin County', state = 'OH'): PropertyRecord {
  return { id, county, state } as PropertyRecord;
}

test('applyFreemiumResultGating restricts free tier per county and shows exact missing nationwide/county counts', () => {
  const singleCountySample = Array.from({ length: 12 }, (_, i) => makeProp(`p-${i}`, 'Franklin County', 'OH'));

  const freeCounty = applyFreemiumResultGating(singleCountySample, 'free', false, 312, 142850);
  assert.equal(freeCounty.unlocked.length, FREE_RESULTS_PER_COUNTY);
  assert.equal(freeCounty.lockedCount, 312 - FREE_RESULTS_PER_COUNTY);
  assert.equal(freeCounty.isGated, true);

  // Nationwide: 3 properties across 4 distinct counties -> max 2 per county = 8 unlocked out of 142,850
  const multiCountySample = [
    makeProp('a1', 'Franklin County', 'OH'),
    makeProp('a2', 'Franklin County', 'OH'),
    makeProp('a3', 'Franklin County', 'OH'),
    makeProp('b1', 'Maricopa County', 'AZ'),
    makeProp('b2', 'Maricopa County', 'AZ'),
    makeProp('b3', 'Maricopa County', 'AZ'),
    makeProp('c1', 'Cook County', 'IL'),
    makeProp('c2', 'Cook County', 'IL'),
    makeProp('c3', 'Cook County', 'IL'),
    makeProp('d1', 'Miami-Dade County', 'FL'),
    makeProp('d2', 'Miami-Dade County', 'FL'),
    makeProp('d3', 'Miami-Dade County', 'FL'),
  ];

  const freeNational = applyFreemiumResultGating(multiCountySample, 'free', true, 312, 142850);
  assert.equal(freeNational.unlocked.length, 8);
  assert.equal(freeNational.countiesRepresented, 4);
  assert.equal(freeNational.lockedCount, 142842);
  assert.equal(freeNational.isGated, true);

  // Pro and Lifetime unlock 100% of all results
  const proNational = applyFreemiumResultGating(multiCountySample, 'pro', true, 312, 142850);
  assert.equal(proNational.unlocked.length, 12);
  assert.equal(proNational.lockedCount, 0);
  assert.equal(proNational.isGated, false);

  const lifetimeCounty = applyFreemiumResultGating(singleCountySample, 'vip_lifetime', false, 312, 142850);
  assert.equal(lifetimeCounty.unlocked.length, 12);
  assert.equal(lifetimeCounty.lockedCount, 0);
  assert.equal(lifetimeCounty.isGated, false);
});
