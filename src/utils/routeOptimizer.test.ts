import test from 'node:test';
import assert from 'node:assert/strict';
import type { FieldRouteStop } from '../types.ts';
import { optimizeFieldRouteOrder } from './routeOptimizer.ts';

test('optimizeFieldRouteOrder orders stops by nearest neighbor distance', () => {
  const stops: FieldRouteStop[] = [
    { id: '1', address: 'Far North', city: 'Columbus', state: 'OH', lat: 40.1, lng: -83.0, visitedAt: '', conditionTag: 'Vacant / Overgrown', notes: '' },
    { id: '2', address: 'South', city: 'Columbus', state: 'OH', lat: 39.9, lng: -83.0, visitedAt: '', conditionTag: 'Probate Lead', notes: '' },
    { id: '3', address: 'Midtown', city: 'Columbus', state: 'OH', lat: 39.95, lng: -83.0, visitedAt: '', conditionTag: 'Follow-Up Needed', notes: '' },
  ];

  const result = optimizeFieldRouteOrder(stops, { lat: 39.89, lng: -83.0 });
  assert.deepEqual(result.ordered.map((s) => s.id), ['2', '3', '1']);
  assert.ok(result.totalDistanceMiles > 0);
});
