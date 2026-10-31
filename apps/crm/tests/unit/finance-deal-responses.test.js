import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readEarnPreview,
  readFinanceAssignees,
  readHandover,
  readHandoverResult,
  readRevised,
} from '../../src/features/server/finance/dealResponses.js';
import { readDeal } from '../../src/features/server/finance/dealModel.js';

const person = (id, name) => ({ id, name });
const lines = [
  { role: 'primary', agent: person('u-sara', 'Sara'), shareBp: 5000, amountFils: 2_450_000 },
  { role: 'second', agent: person('u-omar', 'Omar'), shareBp: 1000, amountFils: 245_000 },
];
const calculation = (extra = {}) => ({
  preview: false,
  revision: 1,
  grossFils: 4_900_000,
  partnerFils: 0,
  netFils: 4_900_000,
  vatFils: 245_000,
  companyFils: 2_205_000,
  lines,
  adjusted: true,
  splitSource: 'override',
  agreementId: 'a-1',
  ...extra,
});
const dealView = (extra = {}) => ({
  ...{ id: 'd-1', version: 2, dealId: 'DL-0001', assignee: person('u-sara', 'Sara') },
  ...{ clientId: 'CL-1', propertyId: null, dealType: 'Sale', stage: 'Offer' },
  ...{ agreedValueFils: 245_000_000, feeBasis: 'percentage', feeRateBp: 200, fixedFeeFils: null },
  ...{ partnerShareBp: 0, partnerName: null, earnedOn: '2026-10-01', details: {} },
  secondAgent: { id: 'u-omar', name: 'Omar', shareBp: 1000, kind: 'referral' },
  override: { agentShareBp: 5000, reason: 'Private reason' },
  calculation: calculation(),
  ...{ receivedFils: 0, outstandingFils: 4_900_000, paymentStatus: 'outstanding' },
  pendingHandover: 'h-1',
  allowed: { handOver: true, earn: true, assign: 'yes' },
  ...extra,
});
const handover = (extra = {}) => ({
  ...{ id: 'h-1', dealId: 'DL-0001', dealType: 'Sale', stage: 'Offer', earned: false },
  ...{ from: person('u-sara', 'Sara'), to: person('u-omar', 'Omar'), referralShareBp: 1000 },
  ...{ status: 'pending', createdAt: '2026-10-14T08:00:00.000Z' },
  allowed: { accept: true, decline: true, cancel: false, approve: 1 },
  ...extra,
});

test('deal views keep the hand-over marker, the handOver flag and the second-agent kind', () => {
  const team = readDeal(dealView(), true);
  assert.equal(team.pendingHandover, 'h-1');
  assert.deepEqual(team.secondAgent, {
    id: 'u-omar',
    name: 'Omar',
    shareBp: 1000,
    kind: 'referral',
  });
  assert.equal(team.calculation.agreementId, 'a-1');
  assert.equal(team.allowed.handOver, true);
  assert.equal(team.allowed.assign, false, 'only JSON true allows');
  const own = readDeal(dealView(), false);
  assert.deepEqual(own.secondAgent, { id: null, name: 'Omar', shareBp: null, kind: null });
  assert.equal(own.override, null);
  assert.equal(own.calculation.companyFils, null);
  assert.equal(own.calculation.agreementId, null);
  assert.equal(JSON.stringify(own).includes('Private reason'), false);
});

test('hand-over views show no money and are read strictly', () => {
  const view = readHandover(handover());
  assert.deepEqual(view.allowed, {
    ...{ review: false, accept: true, decline: true, cancel: false, approve: false },
    ...{ approveAcceptance: false, rejectAcceptance: false },
  });
  assert.equal(view.toAdmin, false);
  assert.equal(view.approval, null);
  assert.equal(JSON.stringify(view).includes('Fils'), false);
  for (const broken of [
    { status: 'sent' },
    { referralShareBp: 10.5 },
    { earned: 'no' },
    { to: { id: '' } },
    { dealType: 'Lease' },
  ])
    assert.throws(() => readHandover(handover(broken)), /invalid finance/, JSON.stringify(broken));
  const moved = readHandoverResult(
    { handover: handover({ status: 'accepted' }), entry: null },
    false,
  );
  assert.equal(moved.entry, null, 'the deal left the caller’s view');
  assert.equal(
    readHandoverResult({ handover: handover(), entry: dealView() }, true).entry.dealId,
    'DL-0001',
  );
});

test('earn preview, revise and assignee responses are shaped by scope', () => {
  const body = {
    preview: {
      earnedOn: '2026-10-10',
      agreement: { id: 'a-1', agentShareBp: 6000 },
      calculation: calculation({ preview: true, revision: null }),
      warnings: ["Deal holder is not the client's holder."],
    },
  };
  const preview = readEarnPreview(body, true);
  assert.deepEqual(preview.agreement, { id: 'a-1', agentShareBp: 6000 });
  assert.equal(preview.calculation.splitSource, 'override');
  assert.equal(preview.warnings.length, 1);
  assert.equal(
    readEarnPreview({ preview: { ...body.preview, agreement: null } }, true).agreement,
    null,
  );
  assert.throws(() => readEarnPreview({ preview: { ...body.preview, earnedOn: '10/10' } }, true));
  const revised = readRevised(
    { deal: dealView(), before: calculation(), after: calculation({ revision: 2 }) },
    true,
  );
  assert.equal(revised.after.revision, 2);
  assert.equal(revised.before.companyFils, 2_205_000);
  const assignees = readFinanceAssignees({
    assignees: [
      { id: 'u-1', name: 'Aidah', kind: 'owner' },
      { id: 'u-2', name: 'Sara', kind: 'staff' },
    ],
  });
  assert.deepEqual(
    assignees.map((row) => row.kind),
    ['owner', 'staff'],
  );
  assert.throws(() => readFinanceAssignees({ assignees: [{ id: 'u', name: 'X', kind: 'admin' }] }));
});
