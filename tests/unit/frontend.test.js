import assert from 'node:assert/strict';
import test from 'node:test';
import {
  crmRoutes,
  routeName,
  routePath,
  routes,
  settingsRoutes,
} from '../../src/config/routes.js';
import {
  selectClientDesk,
  selectClientMatches,
  selectClientTimeline,
} from '../../src/features/clients/selectors.js';
import {
  defaultPropertyFilters,
  selectProperties,
} from '../../src/features/properties/selectors.js';
import { removeWorkspaceRecord, saveWorkspaceRecord } from '../../src/features/records/commands.js';
import { matchesRecordTab } from '../../src/features/records/selectors.js';
import { validateRecord } from '../../src/features/records/validation.js';
import {
  rollingMonths,
  selectDateRecords,
  selectMonthlyPerformance,
  selectPerformanceMonth,
} from '../../src/features/reports/selectors.js';
import { formatValue } from '../../src/lib/crm.js';
import { blank, schema } from '../../src/lib/schema.js';
import { normalizeEnvelope, safeExternalUrl } from '../../src/lib/validation.js';
import { createFullBackup, parseFullBackup } from '../../src/services/files/backup.js';
import { createWorkspaceRepository } from '../../src/services/storage/workspaceRepository.js';

test('validated storage reads preserve malformed data and report blocked storage without a demo replacement', () => {
  for (const raw of [
    '{bad json',
    'null',
    JSON.stringify({ data: { Clients: {} } }),
    JSON.stringify({ data: { Clients: [null] } }),
  ]) {
    let writes = 0;
    const result = createWorkspaceRepository(() => ({
      getItem: () => raw,
      setItem: () => writes++,
    })).read();
    assert.equal(result.workspace, null);
    assert.ok(result.error);
    assert.equal(result.raw, raw);
    assert.equal(writes, 0);
  }
  const blocked = createWorkspaceRepository(() => {
    throw Error('Blocked');
  }).read();
  assert.equal(blocked.raw, null);
  assert.ok(blocked.error);
});

test('valid envelopes retain metadata, fill missing module arrays and reject invalid fields/duplicate IDs', () => {
  const record = { client_id: 'CL-1', full_name: 'Existing', extra: 'Preserved' };
  const normalized = normalizeEnvelope({
    data: { Clients: [record] },
    demo: false,
    metadata: { origin: 'old' },
  });
  assert.deepEqual(normalized.data.Properties, []);
  assert.equal(normalized.data.Clients[0], record);
  assert.deepEqual(normalized.metadata, { origin: 'old' });
  for (const clients of [[{ client_id: 'CL-1', full_name: {} }], [record, record], [{}]])
    assert.throws(() => normalizeEnvelope({ data: { Clients: clients } }));
});

test('record validation requires only an ID and reports duplicates and invalid input', () => {
  assert.deepEqual(validateRecord('Clients', { client_id: 'CL-1' }), {});
  assert.ok(validateRecord('Clients', { client_id: ' ' }).client_id);
  assert.ok(validateRecord('Clients', { client_id: 'CL-1' }, [{ client_id: 'CL-1' }]).client_id);
  const original = { client_id: 'CL-1' };
  assert.deepEqual(validateRecord('Clients', original, [original], original), {});
  const errors = validateRecord('Clients', {
    client_id: 'CL-1',
    email: 'invalid',
    maximum_budget_aed: '-1',
    lead_quality_score_100: 120,
    date_added: '2026-02-30',
  });
  assert.ok(errors.email);
  assert.ok(errors.maximum_budget_aed);
  assert.ok(errors.lead_quality_score_100);
  assert.ok(errors.date_added);
  assert.ok(
    validateRecord('Properties', { property_id: 'PR-1', virtual_tour_url: 'javascript:alert(1)' })
      .virtual_tour_url,
  );
});

test('save/delete commands preserve the original envelope, references and pricing defaults', () => {
  const original = { property_id: 'PR-1', listing_title: 'Old' };
  const second = { property_id: 'PR-2' };
  const db = {
    data: { ...blank(), Properties: [original, second] },
    demo: false,
    createdAt: 'existing',
  };
  const result = saveWorkspaceRecord(
    db,
    'Properties',
    { ...original, listing_title: 'Updated', sale_rental: 'Holiday home' },
    original,
  );
  assert.equal(result.workspace.data.Properties[0].price_basis, 'Nightly');
  assert.equal(result.workspace.data.Properties[1], second);
  assert.equal(db.data.Properties[0].listing_title, 'Old');
  assert.equal(result.workspace.createdAt, 'existing');
  const removed = removeWorkspaceRecord(result.workspace, 'Properties', original);
  assert.deepEqual(removed.data.Properties, [second]);
  assert.equal(result.workspace.data.Properties.length, 2);
});

test('failed validation and oversized saves leave the workspace unchanged', () => {
  const db = { data: blank(), demo: false };
  assert.equal(saveWorkspaceRecord(db, 'Clients', { client_id: '' }).workspace, undefined);
  assert.match(
    saveWorkspaceRecord(db, 'Properties', { property_id: 'PR-1', notes: 'x'.repeat(3000000) })
      .message,
    /storage/i,
  );
  assert.equal(db.data.Properties.length, 0);
});

test('backup validation round-trips media and rejects unsupported versions and invalid module data', () => {
  const data = blank();
  data.Properties.push({
    property_id: 'PR-1',
    media_photos: [
      { name: 'photo.jpg', src: 'data:image/jpeg;base64,dGVzdA==', type: 'image/jpeg' },
    ],
  });
  const backup = createFullBackup(data, '2026-10-08');
  assert.deepEqual(parseFullBackup(JSON.stringify(backup)), data);
  assert.throws(() => parseFullBackup(JSON.stringify({ ...backup, version: 99 })), /version/);
  assert.throws(
    () => parseFullBackup(JSON.stringify({ ...backup, data: { ...data, Clients: {} } })),
    /Clients/,
  );
  assert.throws(() => parseFullBackup('{bad json'));
  data.Properties[0].media_photos[0].src = 'javascript:alert(1)';
  assert.throws(() => parseFullBackup(JSON.stringify(backup)), /media/);
});

test('property selectors combine purpose, field, price and linked text filters without mutating records', () => {
  const data = blank();
  const property = {
    property_id: 'PR-1',
    sale_rental: 'Rental',
    emirate: 'Dubai',
    bedrooms: 2,
    price_annual_rent_aed: 100000,
    listing_title: 'Marina rental',
  };
  data.Properties = [
    property,
    { property_id: 'PR-2', sale_rental: 'Sale', emirate: 'Dubai', price_annual_rent_aed: 500000 },
  ];
  const filters = {
    ...defaultPropertyFilters(),
    purpose: 'Rental',
    bedrooms: '2',
    maxPrice: '110000',
  };
  assert.deepEqual(selectProperties(data, { filters, query: ' MARINA ' }), [property]);
  assert.equal(data.Properties.length, 2);
  filters.maxPrice = '90000';
  assert.deepEqual(selectProperties(data, { filters }), []);
});

test('client matching retains the 8 percent budget tolerance and client search chooses a matching profile', () => {
  const data = blank();
  const a = {
    client_id: 'CL-1',
    full_name: 'Alice',
    buy_rent: 'Buy',
    maximum_budget_aed: 1000000,
    preferred_communities: 'Marina, Downtown',
  };
  const b = { client_id: 'CL-2', full_name: 'Bob' };
  data.Clients = [a, b];
  data.Properties = [
    {
      property_id: 'PR-1',
      sale_rental: 'Sale',
      community: 'Dubai Marina',
      price_annual_rent_aed: 1080000,
    },
    {
      property_id: 'PR-2',
      sale_rental: 'Sale',
      community: 'Dubai Marina',
      price_annual_rent_aed: 1080001,
    },
    {
      property_id: 'PR-3',
      sale_rental: 'Rental',
      community: 'Marina',
      price_annual_rent_aed: 100000,
    },
  ];
  assert.deepEqual(selectClientMatches(data.Properties, a), [data.Properties[0]]);
  assert.equal(selectClientDesk(data, 'bob', 'CL-1').client, b);
  assert.equal(selectClientDesk(data, 'no results', 'CL-1').client, undefined);
});

test('client timelines include both follow-ups and viewings, newest first', () => {
  const data = blank();
  const client = { client_id: 'CL-1' };
  data['Follow-ups'] = [
    {
      activity_id: 'FU-1',
      client_id: 'CL-1',
      contact_date: '2026-01-01',
      next_action: 'Call',
      outcome_notes: 'Discussed budget',
    },
  ];
  data.Viewings = [
    { viewing_id: 'VW-1', client_id: 'CL-1', appointment_date_time: '2026-02-01T10:00' },
  ];
  const timeline = selectClientTimeline(data, client);
  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].title, 'Property viewing');
  assert.equal(timeline[1].detail, 'Discussed budget');
});

test('rolling reports include February from a month-end date and report the selected historical month', () => {
  const now = new Date(2026, 2, 31);
  assert.deepEqual(rollingMonths(3, now), ['2026-01', '2026-02', '2026-03']);
  const data = blank();
  data.Clients = [{ client_id: 'CL-1', date_added: '2020-02-01' }];
  assert.equal(selectMonthlyPerformance(data, now).length, 12);
  assert.equal(selectPerformanceMonth(data, '2020-02').newLeads, 1);
  assert.equal(selectPerformanceMonth(data, '2026-02').newLeads, 0);
});

test('date search uses inclusive boundaries, chronological order and explicit invalid ranges', () => {
  const data = blank();
  data.Clients = [
    { client_id: 'CL-2', date_added: '2026-10-08' },
    { client_id: 'CL-1', date_added: '2026-10-01' },
    { client_id: 'CL-3', date_added: '2026-09-30' },
  ];
  const filter = { type: 'New enquiries', start: '2026-10-01', end: '2026-10-08' };
  assert.deepEqual(
    selectDateRecords(data, filter).records.map((row) => row.client_id),
    ['CL-1', 'CL-2'],
  );
  assert.equal(selectDateRecords(data, { ...filter, start: '2026-10-09' }).invalidRange, true);
  assert.equal(data.Clients[0].client_id, 'CL-2');
});

test('20 CRM sections and five account/workspace screens have unique stable routes and safe external links', () => {
  assert.equal(crmRoutes.length, 20);
  assert.equal(settingsRoutes.length, 5);
  assert.equal(routes.length, 25);
  assert.equal(new Set(routes.map((route) => route.path)).size, 25);
  assert.equal(routePath('Messages'), '/messages');
  assert.equal(
    routes.some((route) => route.name === 'Calendar'),
    false,
  );
  assert.equal(routePath('Leads'), '/leads');
  for (const route of routes) assert.equal(routeName(routePath(route.name)), route.name);
  assert.equal(routeName('/unknown'), 'Page not found');
  assert.equal(safeExternalUrl('javascript:alert(1)'), '');
  assert.equal(safeExternalUrl('data:text/html,test'), '');
  assert.equal(safeExternalUrl('https://example.com/tour'), 'https://example.com/tour');
});

test('fee/percentage metadata renders earned currency correctly and tab filters retain workflow rules', () => {
  assert.equal(
    schema('Clients').find((field) => field.key === 'lead_quality_score_100').type,
    'number',
  );
  assert.equal(schema('Deals').find((field) => field.key === 'partner_share').type, 'number');
  const field = schema('Deals').find((field) => field.key === 'your_earned_fee_aed');
  assert.equal(field.type, 'number');
  const data = blank();
  const deal = {
    deal_id: 'DL-1',
    agreed_value_aed: 1000000,
    fee_basis: 'Percentage',
    fee_rate: 2,
    your_share: 50,
    earned_date: '2026-10-01',
  };
  assert.match(formatValue(data, 'Deals', deal, field), /10,000/);
  assert.ok(validateRecord('Deals', { deal_id: 'DL-2', fee_rate: 101 }).fee_rate);
  assert.ok(
    validateRecord('Clients', {
      client_id: 'CL-1',
      minimum_budget_aed: 500,
      maximum_budget_aed: 100,
    }).maximum_budget_aed,
  );
  assert.equal(matchesRecordTab('Deals', { deal_stage: 'Completed' }, 'Completed'), true);
  assert.equal(matchesRecordTab('Deals', { deal_stage: 'Completed' }, 'Open'), false);
  assert.equal(matchesRecordTab('Follow-ups', { task_status: 'Completed' }, 'Open'), false);
});
