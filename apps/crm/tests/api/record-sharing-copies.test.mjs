import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { add, list, workspacePath } from './assignment-helpers.mjs';
import { query } from './helpers.mjs';
import { createDeal, heldClient } from './finance-deals-helpers.mjs';
import { accept, offered, reviewTeams } from './finance-handover-helpers.mjs';
import { richDeal } from './finance-handover-fixtures.mjs';
import { act, accepted, copy, offer } from './record-sharing-helpers.mjs';
import { shareRequest, shareState } from './record-sharing-helpers.mjs';

// R1 copies (docs/record-sharing.md, amendments 3, 4, 6 and 9): what a colleague's
// view-only copy carries, expiry, and the clash with a hand-over's shared listing.
let teams;
const missing = { code: 'not_found', message: 'Record not found.' };
before(async () => {
  teams = await reviewTeams('share-copies');
});

const words = (...lines) => lines.join(' ').split(' ');
/** `listing_fields::shared`: the review allowlist, the listing's ID and its media. */
const LISTING = words(
  'listing_title sale_rental emirate community building_project unit_reference',
  'property_type bedrooms bathrooms area_sq_ft price_annual_rent_aed price_basis',
  'listing_status ready_off_plan furnishing available_from rental_cheques deposit_aed',
  'minimum_stay_nights maximum_guests parking_spaces amenities property_description',
  'key_selling_points address map_link listing_url virtual_tour_url floor_plan_url',
  'property_id media_photos media_floorplans',
);
const CONTACT = words(
  'contact_id full_name contact_type company phone email building_project community',
  'emirate address map_link',
);
const pick = (record, keys) =>
  Object.fromEntries(Object.entries(record).filter(([key]) => keys.includes(key)));

/** An owner contact and their listing, held by `agent`, with fields a copy withholds. */
async function listingWithOwner(agent) {
  const contact = await add(agent, 'Contacts', {
    full_name: 'Synthetic Qwowner Person',
    contact_type: 'Owner',
    company: 'Synthetic Holdings',
    phone: '+971500000411',
    email: 'qw.owner@example.test',
    building_project: 'Synthetic Park',
    community: 'Dubai Hills',
    emirate: 'Dubai',
    address: 'Synthetic Street 4',
    map_link: 'https://maps.example.test/qw-owner',
    notes: 'Qw contact private note',
    record_check: 'Qw contact check',
  });
  const property = await add(agent, 'Properties', {
    listing_title: 'Synthetic Creek Loft',
    community: 'Dubai Creek Harbour',
    unit_reference: 'QW-UNIT-4',
    contact_id: contact.record.contact_id,
    notes: 'Qw property private note',
    viewing_instructions: 'Qw key with the guard',
    photos_documents_url: 'https://docs.example.test/qw-folder',
    permit_reference: 'QW-PERMIT-1',
    permit_expiry: '2027-03-31',
    listing_authorization: 'Qw form A',
  });
  return { contact, property };
}

/** A PATCH of a record the caller only reads, or cannot see, is the hidden 404. */
async function refusesEdit(session, collection, made) {
  const result = await session.request(workspacePath(session, collection, made.id), {
    method: 'PATCH',
    body: { version: made.version, record: { ...made.record, notes: 'Synthetic R1 edit' } },
  });
  assert.equal(result.status, 404, `${collection}: ${JSON.stringify(result.value)}`);
  assert.deepEqual(result.value, missing);
  const notes = query(`SELECT payload->>'notes' FROM crm_records WHERE id='${made.id}'`);
  assert.equal(notes, made.record.notes, `${collection} is unchanged`);
}

test('a property copy is the listing allowlist and never reveals its owner contact', async () => {
  const { agent, second } = teams;
  const { contact, property } = await listingWithOwner(agent);
  await accepted(agent, property, second, 'Properties');
  const seen = await copy(second, 'Properties', property.id);
  assert.deepEqual(seen.entry.record, pick(property.record, LISTING));
  for (const key of ['contact_id', 'notes', 'viewing_instructions', 'photos_documents_url'])
    assert.ok(!(key in seen.entry.record), `${key} is withheld`);
  for (const key of ['permit_reference', 'permit_expiry', 'listing_authorization'])
    assert.ok(!(key in seen.entry.record), `${key} is withheld`);
  assert.deepEqual([seen.entry.assignee, seen.kept.reason], [null, 'colleague']);
  const owner = await copy(second, 'Contacts', contact.id);
  assert.deepEqual(owner, { entry: undefined, kept: undefined }, 'the owner stays hidden');
  await refusesEdit(second, 'Contacts', contact);
  await refusesEdit(second, 'Properties', property);
});

test('a contact copy carries only its listed fields and reveals no properties', async () => {
  const { agent, third } = teams;
  const { contact, property } = await listingWithOwner(agent);
  await accepted(agent, contact, third, 'Contacts');
  const seen = await copy(third, 'Contacts', contact.id);
  assert.deepEqual(seen.entry.record, pick(contact.record, CONTACT));
  assert.deepEqual(Object.keys(seen.entry.record).sort(), [...CONTACT].sort());
  assert.deepEqual([seen.entry.assignee, seen.kept.reason], [null, 'colleague']);
  assert.deepEqual(seen.kept.other, { id: agent.user.id, name: agent.user.name });
  assert.equal((await copy(third, 'Properties', property.id)).entry, undefined);
  await refusesEdit(third, 'Contacts', contact);
});

/** The guard freezes both dates, so this test-only statement skips triggers for its own
 * session; the table's check still holds `expires_at = created_at + 14 days`. */
const backdate = (share) =>
  query(`SET session_replication_role = replica; UPDATE crm_record_shares SET
    created_at=now()-interval '15 days', expires_at=now()-interval '15 days'+interval '14 days'
    WHERE id='${share.id}'`);

test('a pending share past its end reads expired, cannot be accepted, and frees the colleague', async () => {
  const { agent, second } = teams;
  const client = await add(agent, 'Clients', { full_name: 'Synthetic Expiry Person' });
  const share = await offer(agent, client, second);
  backdate(share);
  const read = await shareRequest(second, `/${share.id}`);
  assert.equal(read.status, 200, JSON.stringify(read.value));
  assert.deepEqual([read.value.share.status, read.value.share.label], ['expired', null]);
  assert.equal(Object.values(read.value.share.allowed).some(Boolean), false);
  assert.equal((await shareRequest(second, '/waiting')).value.Clients, 0);
  const accepting = await act(second, share, 'accept');
  assert.equal(accepting.status, 409, JSON.stringify(accepting.value));
  assert.equal(accepting.value.code, 'conflict');
  assert.equal(shareState(share), 'expired|-', 'the write marks it expired');
  assert.equal((await copy(second, 'Clients', client.id)).entry, undefined);
  const again = await offer(agent, client, second);
  assert.equal(again.status, 'pending', 'a new share to the same colleague is allowed');
});

test('a hand-over that shares a listing replaces the colleague copy of it', async () => {
  const { admin, agent, second } = teams;
  const { deal, property } = await richDeal(agent);
  await createDeal(agent, await heldClient(agent), { propertyId: property.record.property_id });
  const share = await accepted(agent, property, second, 'Properties');
  const done = await accept(second, admin, await offered(admin, agent, deal, second));
  assert.equal(done.status, 200, JSON.stringify(done.value));
  assert.deepEqual(done.value.records, { client: 'moved', property: 'shared' });
  const keeps = query(`SELECT string_agg(reason||':'||coalesce(share_id::text,'-'),',')
    FROM crm_record_keeps WHERE record_id='${property.id}' AND member_id='${second.user.id}'`);
  assert.equal(keeps, 'shared:-', 'one hand-over keep, no colleague keep');
  assert.equal(shareState(share), 'ended|-');
  const { records, kept } = await list(second);
  assert.equal(records.Properties.filter((row) => row.id === property.id).length, 1);
  assert.equal(kept[property.id].reason, 'shared');
});
