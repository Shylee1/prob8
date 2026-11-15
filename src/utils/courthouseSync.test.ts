import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkScheduledCourthouseSlot,
  computeNextWeekdaySyncLabel,
  createInitialCourthouseState,
  executeCourthouseSyncCycle,
} from './courthouseSync.ts';

test('courthouseSync runs twice-daily M-F 11 AM & 3 PM ET schedule and tracks adds, updates, and purges', () => {
  // Monday Nov 16 2026 11:00 AM ET = 16:00 UTC
  const mon11amEt = new Date('2026-11-16T16:00:00Z');
  const slot11 = checkScheduledCourthouseSlot(mon11amEt, '');
  assert.equal(slot11.triggered, true);
  assert.match(slot11.slotLabel || '', /11:00 AM ET/);

  // Duplicate check in same minute does not double-fire
  const dup = checkScheduledCourthouseSlot(mon11amEt, slot11.triggerKey);
  assert.equal(dup.triggered, false);

  // Monday Nov 16 2026 3:00 PM ET = 20:00 UTC
  const mon3pmEt = new Date('2026-11-16T20:00:00Z');
  const slot3 = checkScheduledCourthouseSlot(mon3pmEt, slot11.triggerKey);
  assert.equal(slot3.triggered, true);
  assert.match(slot3.slotLabel || '', /3:00 PM ET/);

  // Next label checks
  const mon10amEt = new Date('2026-11-16T15:00:00Z');
  assert.match(computeNextWeekdaySyncLabel(mon10amEt), /Today 11:00 AM ET/);
  const mon12pmEt = new Date('2026-11-16T17:00:00Z');
  assert.match(computeNextWeekdaySyncLabel(mon12pmEt), /Today 3:00 PM ET/);

  // Cycle execution adds, updates, purges
  const state = createInitialCourthouseState(142850);
  const run = executeCourthouseSyncCycle(state, slot3.slotLabel!);
  assert.ok(run.newFilingsIngested > 0);
  assert.ok(run.existingPropertiesUpdated > 0);
  assert.ok(run.soldPropertiesPurged > 0);
  assert.ok(state.updatedCaseMilestones.size > 0);
  assert.equal(state.syncHistory.length, 2);
});
