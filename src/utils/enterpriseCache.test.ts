import test from 'node:test';
import assert from 'node:assert/strict';
import { EnterpriseLruTtlCache } from './enterpriseCache.ts';

test('EnterpriseLruTtlCache enforces LRU eviction, TTL expiration, and in-flight coalescing', async () => {
  const cache = new EnterpriseLruTtlCache<string>(2, 1000);
  cache.set('k1', 'v1', 1000, 100);
  cache.set('k2', 'v2', 1000, 100);
  assert.equal(cache.get('k1', 200), 'v1'); // k1 refreshed, k2 is now LRU
  cache.set('k3', 'v3', 1000, 200);
  assert.equal(cache.get('k2', 200), undefined); // evicted
  assert.equal(cache.get('k1', 1200), undefined); // expired

  let computeCalls = 0;
  const loader = async () => {
    computeCalls += 1;
    await new Promise((r) => setTimeout(r, 20));
    return 'shared-result';
  };
  const [a, b, c] = await Promise.all([
    cache.getOrCompute('hot-key', loader),
    cache.getOrCompute('hot-key', loader),
    cache.getOrCompute('hot-key', loader),
  ]);
  assert.equal(a, 'shared-result');
  assert.equal(b, 'shared-result');
  assert.equal(c, 'shared-result');
  assert.equal(computeCalls, 1);
  assert.equal(cache.getStats().coalescedRequests, 2);
});
