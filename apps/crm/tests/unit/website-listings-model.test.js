import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emirateName,
  filterListings,
  listingRows,
  listingStatus,
  liveRecordIds,
  priceKey,
  recordWebsite,
} from '../../src/features/server/website/listings/listingsModel.js';
import { existingFor } from '../../src/features/server/website/publish/publishModel.js';

const publication = (id, recordId, extra = {}) => ({
  id,
  recordId,
  agentProfileId: 'profile-a',
  version: 1,
  sourceVersion: 3,
  active: true,
  snapshot: {
    title: `Synthetic ${id}`,
    purpose: 'buy',
    emirate: 'abu-dhabi',
    price: 1500000,
    publishedAt: '2026-10-29T08:00:00Z',
  },
  ...extra,
});
const entry = (id, version, record = {}) => ({
  id,
  version,
  record: { community: 'Saadiyat', ...record },
});

test('status: withdrawn when inactive, changed when the record moved on, else live', () => {
  assert.equal(
    listingStatus(publication('a', 'r1', { active: false }), entry('r1', 9)),
    'withdrawn',
  );
  assert.equal(listingStatus(publication('a', 'r1'), entry('r1', 4)), 'changed');
  assert.equal(listingStatus(publication('a', 'r1'), entry('r1', 3)), 'live');
  assert.equal(listingStatus(publication('a', 'r1'), null), 'live');
});

test('rows join the CRM entry and keep public snapshot facts', () => {
  const [row, orphan] = listingRows([publication('a', 'r1'), publication('b', 'gone')], {
    Properties: [entry('r1', 3)],
  });
  assert.equal(row.entry.id, 'r1');
  assert.equal(row.title, 'Synthetic a');
  assert.equal(row.area, 'Saadiyat · Abu Dhabi');
  assert.equal(row.price, 1500000);
  assert.equal(row.publishedAt, '2026-10-29T08:00:00Z');
  assert.equal(orphan.entry, null);
  assert.equal(orphan.area, 'Abu Dhabi');
  assert.equal(
    listingRows([{ ...publication('c', 'r1'), publishedAt: 'top' }], {})[0].publishedAt,
    'top',
  );
});

test('filters: Live includes changed rows; search matches the title', () => {
  const rows = listingRows(
    [
      publication('live', 'r1'),
      publication('edited', 'r2'),
      publication('off', 'r3', { active: false }),
    ],
    { Properties: [entry('r1', 3), entry('r2', 7), entry('r3', 3)] },
  );
  const ids = (list) => list.map((row) => row.publication.id);
  assert.deepEqual(ids(filterListings(rows, { status: 'live' })), ['live', 'edited']);
  assert.deepEqual(ids(filterListings(rows, { status: 'withdrawn' })), ['off']);
  assert.deepEqual(ids(filterListings(rows, { status: 'all' })), ['live', 'edited', 'off']);
  assert.deepEqual(ids(filterListings(rows, { status: 'all', query: ' EDITED ' })), ['edited']);
});

test('a property panel shows the newest live row, else the newest withdrawn one', () => {
  const rows = [
    publication('old', 'r1', { active: false, version: 4 }),
    publication('other', 'r2'),
  ];
  const none = recordWebsite(rows, entry('r1', 3));
  assert.equal(none.status, 'none');
  assert.equal(none.publication.id, 'old');
  const live = recordWebsite([publication('new', 'r1'), ...rows], entry('r1', 5));
  assert.equal(live.status, 'changed');
  assert.equal(live.publication.id, 'new');
  assert.equal(recordWebsite(rows, null).status, 'none');
  assert.deepEqual([...liveRecordIds(rows)], ['r2']);
});

test('republishing reuses the row for the same record and representative', () => {
  const rows = [
    publication('a', 'r1', { version: 5 }),
    publication('b', 'r1', { agentProfileId: 'profile-b' }),
  ];
  assert.equal(existingFor(rows, 'r1', 'profile-a').version, 5);
  assert.equal(existingFor(rows, 'r1', 'profile-b').id, 'b');
  assert.equal(existingFor(rows, 'r1', 'profile-c'), null);
});

test('prices and emirates use the public names', () => {
  assert.equal(priceKey('buy'), 'priceTotal');
  assert.equal(priceKey('rent'), 'priceYear');
  assert.equal(priceKey('holiday'), 'priceNight');
  assert.equal(emirateName('ras-al-khaimah'), 'Ras Al Khaimah');
  assert.equal(emirateName('nowhere'), '');
});
