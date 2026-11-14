import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeZip5, resolveZipSync } from './zipLookup.ts';

test('normalizeZip5 strips non-digits and extracts 5-digit prefix from ZIP+4', () => {
  assert.equal(normalizeZip5('43206-1234'), '43206');
  assert.equal(normalizeZip5(' 90210 '), '90210');
});

test('resolveZipSync auto-populates exact US city & state across major metros', () => {
  const oh = resolveZipSync('43206');
  assert.ok(oh);
  assert.equal(oh.city, 'Columbus');
  assert.equal(oh.state, 'OH');

  const ca = resolveZipSync('90210');
  assert.ok(ca);
  assert.equal(ca.city, 'Beverly Hills');
  assert.equal(ca.state, 'CA');

  const ma = resolveZipSync('02127');
  assert.ok(ma);
  assert.equal(ma.city, 'Boston');
  assert.equal(ma.state, 'MA');
});

test('resolveZipSync falls back to USPS 3-digit SCF prefix across all 50 states', () => {
  const tx = resolveZipSync('76102');
  assert.ok(tx);
  assert.equal(tx.state, 'TX');

  const ak = resolveZipSync('99701');
  assert.ok(ak);
  assert.equal(ak.state, 'AK');

  assert.equal(resolveZipSync('432'), null);
});
