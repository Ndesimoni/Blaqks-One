import test from 'node:test';
import assert from 'node:assert/strict';
import { connectedCollections, readServerRecords } from '../../src/features/server/records.js';
import { linkedDeal, readDealLinks } from '../../src/features/server/projections.js';
import {
  DEAL_LINK_MISSING,
  dealLinkOptions,
  isDealLinkMissing,
  storedDealLabel,
} from '../../src/features/server/dealLinks/dealLinkModel.js';
import { serverMutationFailure, serverSaveFailure } from '../../src/features/server/errors.js';

const log = (id, logId, deal) => ({
  id,
  version: 1,
  record: { log_id: logId, client_id: 'CL-001', deal_id_optional: deal, dealLinks: ['x'] },
  assignee: null,
});
const payload = () => ({
  scope: 'team',
  references: { Clients: [], Properties: [], Contacts: [] },
  taskClients: [],
  listingViewings: [],
  dealLinks: [{ log_id: 'LG-001', deal_id: 'DL-001', extra: 'dropped' }],
  records: {
    ...Object.fromEntries(connectedCollections.map((name) => [name, []])),
    'Interaction log': [log('a', 'LG-001', 'DL-001'), log('b', 'LG-002', 'DL-GONE')],
  },
});

test('dealLinks is a required, strictly parsed projection and a reserved payload key', () => {
  const parsed = readServerRecords(payload());
  assert.deepEqual(parsed.dealLinks, [{ log_id: 'LG-001', deal_id: 'DL-001' }]);
  const record = parsed.entries['Interaction log'][0].record;
  assert.equal(record.dealLinks, undefined);
  assert.equal(record.deal_id_optional, 'DL-001');
  const broken = [
    [(p) => delete p.dealLinks, /incomplete/],
    [(p) => (p.dealLinks = {}), /invalid/],
    [(p) => (p.dealLinks[0].deal_id = ''), /invalid/],
    [(p) => (p.dealLinks[0].log_id = 7), /invalid/],
    [(p) => (p.dealLinks[0].deal_id = 'D'.repeat(129)), /invalid/],
    [(p) => p.dealLinks.push({ log_id: 'LG-001', deal_id: 'DL-002' }), /invalid/],
  ];
  for (const [change, error] of broken) {
    const value = payload();
    change(value);
    assert.throws(() => readServerRecords(value), error);
  }
  assert.deepEqual(readDealLinks([]), []);
});

test('a log shows its deal only through a matching dealLinks entry', () => {
  const projections = { dealLinks: [{ log_id: 'LG-001', deal_id: 'DL-001' }] };
  assert.equal(linkedDeal(projections, 'LG-001', 'DL-001'), 'DL-001');
  // Grandfathered, hidden or edited text never resolves by matching.
  assert.equal(linkedDeal(projections, 'LG-002', 'DL-001'), null);
  assert.equal(linkedDeal(projections, 'LG-001', 'DL-002'), null);
  assert.equal(linkedDeal(projections, 'LG-001', ''), null);
  assert.equal(linkedDeal({ dealLinks: [] }, 'LG-001', 'DL-001'), null);
});

const deal = (dealId, assigneeId, clientId = 'CL-1', stage = 'Offer') => ({
  dealId,
  clientId,
  stage,
  assignee: assigneeId ? { id: assigneeId, name: 'Agent' } : null,
});
const overview = {
  deals: [deal('DL-010', 'me'), deal('DL-002', 'other', 'CL-2'), deal('DL-003', null)],
  references: { Clients: [{ id: 'CL-1', name: 'Synthetic Buyer' }], Properties: [] },
};

test('deal choices follow the finance view: team sees all, own sees held deals only', () => {
  const team = dealLinkOptions(overview, { scope: 'team' }, 'me');
  assert.deepEqual(
    team.map((option) => option.id),
    ['DL-002', 'DL-003', 'DL-010'],
  );
  assert.equal(team[2].label, 'DL-010 · Synthetic Buyer · Offer');
  assert.equal(team[0].label, 'DL-002 · CL-2 · Offer');
  assert.deepEqual(dealLinkOptions(overview, { scope: 'own' }, 'me'), [
    { id: 'DL-010', label: 'DL-010 · Synthetic Buyer · Offer' },
  ]);
  assert.deepEqual(dealLinkOptions(overview, { scope: 'own' }, null), []);
  assert.deepEqual(dealLinkOptions(overview, { scope: 'none' }, 'me'), []);
  assert.deepEqual(dealLinkOptions(null, { scope: 'team' }, 'me'), []);
});

test('stored values outside the choices are labelled unavailable once loading ends', () => {
  assert.equal(storedDealLabel('', false), '');
  assert.equal(storedDealLabel('DL-9', true), 'DL-9');
  assert.equal(storedDealLabel('DL-9', false), 'DL-9 · Linked deal unavailable');
});

test('the refused deal link marks the deal field and keeps the server message', () => {
  const refused = { status: 409, message: DEAL_LINK_MISSING, details: { code: 'link_missing' } };
  assert.equal(isDealLinkMissing(refused), true);
  const failure = serverSaveFailure(refused, { log_id: 'LG-001' });
  assert.equal(failure.message, DEAL_LINK_MISSING);
  assert.deepEqual(failure.errors, { deal_id_optional: DEAL_LINK_MISSING });
  assert.equal(failure.conflict, false);
  const property = {
    status: 409,
    message:
      'The linked property is missing from this workspace. Choose another property or clear it.',
    details: { code: 'link_missing' },
  };
  assert.deepEqual(serverSaveFailure(property, null).errors, {});
  // Finance flows keep the plain mapping, even for the same deal message.
  assert.deepEqual(serverMutationFailure(refused, null).errors, {});
  const generic = { status: 409, message: 'A linked record prevents this change.', details: {} };
  assert.equal(serverSaveFailure(generic, null).message, 'A linked record prevents this change.');
});
