import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countMessage,
  draftText,
  feesMessage,
  formatFigure,
  mergeTarget,
  parseTargetDraft,
  progressOf,
  readTargets,
  targetsFor,
} from '../../src/features/server/performance/targetsModel.js';
import { selectConnectedInsights } from '../../src/features/server/insights/insightsModel.js';

const target = (memberId, metric, value, version = 1) => ({
  id: `${memberId}-${metric}`,
  memberId,
  metric,
  value,
  version,
});

test('targets parse strictly and only the Admin flag grants editing', () => {
  const parsed = readTargets({
    month: '2026-10',
    canEdit: 'yes',
    targets: [target(null, 'fees', 5)],
  });
  assert.equal(parsed.canEdit, false);
  assert.equal(parsed.targets.length, 1);
  for (const bad of [
    target(null, 'calls', 1),
    target(null, 'viewings', 1_000_001),
    target(null, 'fees', -1),
    target(null, 'deals', 1, 0),
    { ...target(null, 'deals', 1), memberId: 7 },
  ])
    assert.throws(() => readTargets({ month: '2026-10', targets: [bad] }));
  assert.throws(() => readTargets({ month: '2026-10' }));
});

test('targets are chosen for the selection and merged after saves', () => {
  const rows = [
    target(null, 'enquiries', 40),
    target('amy', 'enquiries', 8),
    target('amy', 'fees', 9),
  ];
  assert.deepEqual(Object.keys(targetsFor(rows, { kind: 'team', memberId: null })), ['enquiries']);
  assert.deepEqual(Object.keys(targetsFor(rows, { kind: 'member', memberId: 'amy' })), [
    'enquiries',
    'fees',
  ]);
  assert.deepEqual(targetsFor(rows, { kind: 'queue', memberId: null }), {});
  const updated = mergeTarget(rows, 'amy', 'fees', target('amy', 'fees', 12, 2));
  assert.equal(updated.find((row) => row.memberId === 'amy' && row.metric === 'fees').value, 12);
  assert.equal(mergeTarget(rows, null, 'enquiries', null).length, 2);
});

test('drafts convert AED to fils and refuse out-of-range counts', () => {
  assert.deepEqual(parseTargetDraft('fees', '50,000.5'), { value: 5_000_050, error: '' });
  assert.deepEqual(parseTargetDraft('fees', ''), { value: null, error: '' });
  assert.equal(parseTargetDraft('fees', '10000000000.01').error, feesMessage);
  assert.equal(parseTargetDraft('fees', '1.234').error, feesMessage);
  assert.deepEqual(parseTargetDraft('viewings', '1,200'), { value: 1200, error: '' });
  for (const bad of ['-1', '2.5', '1000001', 'ten'])
    assert.equal(parseTargetDraft('viewings', bad).error, countMessage, bad);
  assert.equal(draftText('fees', 5_000_050), '50000.50');
  assert.equal(draftText('deals', 3), '3');
  assert.equal(draftText('deals', undefined), '');
  assert.equal(formatFigure('fees', 5_000_050), 'AED 50,000.50');
  assert.equal(formatFigure('enquiries', 1200), '1,200');
  assert.equal(progressOf(3, 4), 75);
  assert.equal(progressOf(3, 0), null);
});

test('insights count tiers and lost reasons, and the deal mix only with deals', () => {
  const data = {
    Clients: [
      { client_id: 'C1', lead_stage: 'Lost', lost_reason: 'Budget' },
      { client_id: 'C2', lead_stage: 'New', funds_confirmed: 'Yes', decision_maker: 'Yes' },
    ],
    'Follow-ups': [],
    Viewings: [],
    'Client care': [],
    Deals: [],
    Payments: [],
    Expenses: [],
  };
  const plain = selectConnectedInsights(data);
  assert.equal(plain.pipelines, null);
  assert.equal(plain.tiers.find((tier) => tier.title === 'Lost').value, 1);
  assert.deepEqual(plain.lostReasons, [{ name: 'Budget', value: 1 }]);
  assert.deepEqual(
    plain.unqualified.map((client) => client.client_id),
    ['C1'],
  );
  const deals = [{ details: { pipeline_type: 'Secondary sale', lost_cancelled_reason: 'Budget' } }];
  const withDeals = selectConnectedInsights(data, deals);
  assert.equal(withDeals.pipelines.find((row) => row.name === 'Secondary sale').value, 1);
  assert.deepEqual(withDeals.lostReasons, [{ name: 'Budget', value: 2 }]);
});
