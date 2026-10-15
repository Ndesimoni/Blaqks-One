import test from 'node:test';
import assert from 'node:assert/strict';
import {
  changeLines,
  historyLabel,
  historyTime,
  readHistory,
} from '../../src/features/server/finance/historyModel.js';

const at = '2026-10-15T08:30:00.000Z';
const team = {
  at,
  action: 'approved',
  actor: { id: 'u-2', name: 'Approver' },
  changes: { vatFils: [50_000, 50_001], selfDecided: true },
  reason: null,
};

test('team history keeps actors and changes; own history keeps only the timeline', () => {
  assert.deepEqual(readHistory({ history: [team] }, true), [
    {
      at,
      action: 'approved',
      actor: { id: 'u-2', name: 'Approver' },
      changes: team.changes,
      reason: null,
    },
  ]);
  const own = readHistory(
    {
      history: [
        { ...team, action: 'updated', reason: 'Hidden reason' },
        { ...team, action: 'rejected', reason: 'Slip missing' },
      ],
    },
    false,
  );
  assert.deepEqual(own, [
    { at, action: 'updated', actor: { id: null, name: 'Approver' }, changes: null, reason: null },
    {
      at,
      action: 'rejected',
      actor: { id: null, name: 'Approver' },
      changes: null,
      reason: 'Slip missing',
    },
  ]);
  assert.throws(() => readHistory({ history: [{ at, action: 'x' }] }, true));
  assert.throws(() => readHistory({}, true));
});

test('change lines format money, shares and redacted text', () => {
  assert.deepEqual(changeLines(team.changes), [
    'VAT: AED 500.00 → AED 500.01',
    'Decided by an Admin on their own record',
  ]);
  assert.deepEqual(changeLines({ receiptUrl: 'changed', agentShareBp: [5000, 6000] }), [
    'Receipt link: changed',
    'Agent Share: 50% → 60%',
  ]);
  assert.deepEqual(changeLines({ incurredBy: [null, 'u-1'], nested: [{ a: 1 }, 2] }), [
    'Incurred by: — → u-1',
    'Nested: changed → 2',
  ]);
  assert.deepEqual(changeLines(null), []);
  assert.equal(historyLabel('resubmitted'), 'Corrected and resubmitted');
  assert.equal(historyLabel('new_action'), 'new action');
  assert.equal(historyTime(at), '15 Oct 2026, 12:30');
  assert.equal(historyTime('later'), 'later');
});
