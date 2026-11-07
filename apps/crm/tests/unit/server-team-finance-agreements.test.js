import test from 'node:test';
import assert from 'node:assert/strict';
import {
  agreementAgents,
  agreementBody,
  agreementErrors,
  agreementStatus,
  agreementTimelines,
  closingNotice,
  periodText,
} from '../../src/features/server-team/agreementModel.js';

const sara = { id: 'sara', name: 'Sara' };
const omar = { id: 'omar', name: 'Omar' };
const rows = [
  {
    id: 'a1',
    agent: sara,
    agentShareBp: 6000,
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-07-01',
  },
  {
    id: 'a2',
    agent: sara,
    agentShareBp: 6500,
    effectiveFrom: '2026-07-01',
    effectiveTo: '2026-11-01',
  },
  { id: 'a3', agent: sara, agentShareBp: 7000, effectiveFrom: '2026-11-01', effectiveTo: null },
  { id: 'b1', agent: omar, agentShareBp: 5500, effectiveFrom: '2026-02-01', effectiveTo: null },
];

test('agreement timelines group per agent, newest first, with in-force/closed/future status', () => {
  const today = '2026-10-15';
  assert.deepEqual(
    rows.map((row) => agreementStatus(row, today)),
    ['closed', 'current', 'future', 'current'],
  );
  assert.equal(agreementStatus(rows[1], '2026-11-01'), 'closed');
  const groups = agreementTimelines(rows);
  assert.deepEqual(
    groups.map((group) => group.agent.name),
    ['Omar', 'Sara'],
  );
  assert.deepEqual(
    groups[1].agreements.map((row) => row.id),
    ['a3', 'a2', 'a1'],
  );
  assert.equal(periodText(rows[0]), 'From 2026-01-01, replaced on 2026-07-01');
  assert.equal(periodText(rows[2]), 'From 2026-11-01, no end date');
});

test('agreement drafts validate the agent, share and start date and explain auto-closing', () => {
  const agents = [sara, omar];
  const draft = { agentId: 'sara', share: '72.5', effectiveFrom: '2027-01-01' };
  assert.deepEqual(agreementErrors(draft, agents), {});
  assert.deepEqual(agreementBody(draft), {
    agentId: 'sara',
    agentShareBp: 7250,
    effectiveFrom: '2027-01-01',
  });
  const bad = agreementErrors(
    { agentId: 'ghost', share: '7.255', effectiveFrom: '2026-02-30' },
    agents,
  );
  assert.deepEqual(Object.keys(bad).sort(), ['agentId', 'effectiveFrom', 'share']);
  assert.equal(
    closingNotice(rows, draft),
    'Their open agreement (70% from 2026-11-01) will close automatically on 2027-01-01.',
  );
  assert.match(closingNotice([], draft), /first agreement\. The team default applies/);
});

test('only current staff can hold agreements', () => {
  const members = [
    { id: 'z', name: 'Zed', roleId: 'staff', status: 'active' },
    { id: 'a', name: 'Amal', roleId: 'staff', status: 'invited' },
    { id: 'x', name: 'Owner', roleId: 'admin', status: 'active' },
    { id: 'y', name: 'Gone', roleId: 'staff', status: 'archived' },
  ];
  assert.deepEqual(agreementAgents(members), [
    { id: 'a', name: 'Amal' },
    { id: 'z', name: 'Zed' },
  ]);
});
