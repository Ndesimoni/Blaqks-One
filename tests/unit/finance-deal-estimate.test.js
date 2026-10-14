import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dealEstimate,
  dubaiToday,
  earnDateLimits,
  shiftDate,
} from '../../src/features/server/finance/dealEstimate.js';
import {
  pairMessage,
  readSplitDraft,
  splitAfter,
  splitChanged,
  splitDraftFromDeal,
} from '../../src/features/server/finance/splitDraft.js';

const body = {
  feeBasis: 'percentage',
  agreedValueFils: 245_000_000,
  feeRateBp: 200,
  fixedFeeFils: null,
  partnerShareBp: 0,
};
const settings = { vatRegistered: true, secondAgentSource: 'first_agent', agentShareBp: 5000 };
const primary = {
  role: 'primary',
  agent: { id: 'u-1', name: 'Sara' },
  shareBp: 6000,
  amountFils: 0,
};
const saved = {
  feeBasis: 'percentage',
  agreedValueFils: 245_000_000,
  feeRateBp: 200,
  partnerShareBp: 0,
  secondAgent: null,
  override: null,
  calculation: { splitSource: 'agreement', lines: [primary], adjusted: false },
};

test('the team estimate reuses the saved deal’s share and never guesses for a new deal', () => {
  const estimate = dealEstimate(body, { team: true, deal: saved, settings });
  assert.deepEqual(
    [estimate.grossFils, estimate.netFils, estimate.vatFils],
    [4_900_000, 4_900_000, 245_000],
  );
  assert.deepEqual(
    estimate.lines.map((line) => [line.role, line.name, line.amountFils]),
    [
      ['primary', 'Sara', 2_940_000],
      ['company', '', 1_960_000],
    ],
  );
  assert.equal(dealEstimate(body, { team: true, deal: null, settings }).lines, null);
  const second = { ...saved, secondAgent: { name: 'Omar', shareBp: 1000, kind: 'referral' } };
  const withSecond = dealEstimate(body, {
    team: true,
    deal: second,
    settings: { ...settings, secondAgentSource: 'company' },
  });
  assert.deepEqual(
    withSecond.lines.map((line) => line.amountFils),
    [2_646_000, 294_000, 1_960_000],
  );
  const queued = { ...saved, calculation: { splitSource: 'owner', lines: [] } };
  assert.deepEqual(dealEstimate(body, { team: true, deal: queued, settings }).lines, [
    { role: 'company', name: '', amountFils: 4_900_000 },
  ]);
  assert.equal(dealEstimate(null, { team: true, settings }), null);
  assert.equal(dealEstimate({ ...body, feeRateBp: 20_000 }, { team: true, settings }), null);
});

test('the own estimate uses only the caller’s agreement and hides what it cannot know', () => {
  const agreements = [
    { id: 'a', agentShareBp: 6000, effectiveFrom: '2026-01-01', effectiveTo: null },
  ];
  const context = {
    team: false,
    settings: { vatRegistered: false },
    agreements,
    today: '2026-10-14',
  };
  const own = dealEstimate(body, { ...context, deal: null });
  assert.deepEqual(own.lines, [{ role: 'primary', name: '', amountFils: 2_940_000 }]);
  assert.equal(own.vatFils, 0);
  assert.equal(dealEstimate(body, { ...context, agreements: [] }).lines, null, 'no team default');
  const adjusted = { ...saved, calculation: { ...saved.calculation, adjusted: true } };
  assert.equal(dealEstimate(body, { ...context, deal: adjusted }).lines, null);
  const shared = { ...saved, secondAgent: { name: 'Omar' } };
  assert.equal(dealEstimate(body, { ...context, deal: shared }).lines, null);
  assert.equal(dealEstimate(body, { ...context, settings: null }).vatFils, null);
});

test('earned dates: Dubai today, never future, staff limited to 31 days back', () => {
  assert.equal(dubaiToday(new Date('2026-10-14T21:30:00Z')), '2026-10-15');
  assert.equal(shiftDate('2026-03-01', -1), '2026-02-28');
  assert.deepEqual(earnDateLimits({ manage: false }, '2026-10-14'), {
    max: '2026-10-14',
    min: '2026-09-13',
  });
  assert.equal(earnDateLimits({ manage: true }, '2026-10-14').min, '2000-01-01');
});

test('the split panel parses shares exactly and pairs the second agent with a share', () => {
  const deal = { ...saved, override: { agentShareBp: 7000, reason: 'r' } };
  const draft = splitDraftFromDeal(deal);
  assert.deepEqual(draft, { secondAgentId: '', secondShare: '', override: '70', reason: '' });
  assert.equal(splitChanged(deal, readSplitDraft(draft).value), false);
  const added = readSplitDraft({ ...draft, secondAgentId: 'u-2', secondShare: '12.5' });
  assert.deepEqual(added.value, {
    secondAgentId: 'u-2',
    secondAgentShareBp: 1250,
    overrideAgentShareBp: 7000,
  });
  assert.equal(splitChanged(deal, added.value), true);
  assert.equal(readSplitDraft({ ...draft, secondAgentId: 'u-2' }).errors.secondShare, pairMessage);
  assert.equal(readSplitDraft({ ...draft, secondShare: '5' }).errors.secondShare, pairMessage);
  assert.ok(readSplitDraft({ ...draft, override: '1.234' }).errors.override);
  const after = splitAfter(saved, settings, added.value, 'split');
  assert.deepEqual(after, { primaryFils: 3_001_250, secondFils: 428_750, companyFils: 1_470_000 });
  const cleared = readSplitDraft({ ...draft, override: '' }).value;
  assert.equal(splitAfter(deal, settings, cleared), null, 'clearing an override is unknown');
});
