import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasAvatar,
  kindKey,
  recordStatus,
  recordTitle,
  subtitleParts,
} from '../../src/features/records/panel/panelModel.js';
import { leadStages, stageTrack } from '../../src/features/records/panel/stageModel.js';

const states = (track) => track.steps.map((step) => step.state);

test('the panel title prefers a name, then a listing title, then a next action, then the ID', () => {
  assert.equal(recordTitle({ full_name: ' Layla Haddad ' }, 'CL-1'), 'Layla Haddad');
  assert.equal(recordTitle({ listing_title: 'Marina Gate 2-bed' }, 'PR-1'), 'Marina Gate 2-bed');
  assert.equal(recordTitle({ next_action: 'Call back' }, 'FU-1'), 'Call back');
  assert.equal(recordTitle({ full_name: '   ' }, 'CL-2'), 'CL-2');
});

test('people get an avatar and the subtitle starts with the record kind', () => {
  assert.ok(hasAvatar('Clients') && hasAvatar('Contacts'));
  assert.ok(!hasAvatar('Properties') && !hasAvatar('Follow-ups'));
  assert.equal(kindKey('Clients'), 'kindClients');
  assert.equal(kindKey('Clients', true), 'kindLeads');
  assert.equal(kindKey('Interaction log'), 'kindInteractionLog');
  assert.equal(kindKey('Properties'), '');
  assert.equal(kindKey('Unknown sheet'), '');
});

test('subtitles show lead source, contact type and company, or a listing price and place', () => {
  assert.deepEqual(subtitleParts('Clients', { lead_source: 'Website' }, 'CL-1'), [
    'Website',
    'CL-1',
  ]);
  assert.deepEqual(subtitleParts('Contacts', { contact_type: 'Landlord', company: ' ' }, 'CT-1'), [
    'Landlord',
    'CT-1',
  ]);
  const listing = {
    price_annual_rent_aed: '190000',
    price_basis: 'Annual',
    community: 'Dubai Marina',
    emirate: 'Dubai',
  };
  const [price, place, id] = subtitleParts('Properties', listing, 'PR-1');
  assert.match(price, /190,000/);
  assert.match(price, /\/ year$/);
  assert.equal(place, 'Dubai Marina, Dubai');
  assert.equal(id, 'PR-1');
  assert.deepEqual(subtitleParts('Properties', {}, 'PR-2'), ['PR-2']);
  assert.deepEqual(subtitleParts('Follow-ups', { channel: 'Call' }, 'FU-1'), ['FU-1']);
  assert.deepEqual(subtitleParts('Clients', {}, ''), []);
});

test('the header status is the record status; client stages use the track instead', () => {
  assert.equal(recordStatus('Properties', { listing_status: 'Under offer' }), 'Under offer');
  assert.equal(recordStatus('Follow-ups', { task_status: ' Open ' }), 'Open');
  assert.equal(recordStatus('Viewings', { viewing_status: 'Confirmed' }), 'Confirmed');
  assert.equal(recordStatus('Interaction log', { action_status: 'Done' }), 'Done');
  assert.equal(recordStatus('Clients', { lead_stage: 'Viewing', task_status: 'Open' }), '');
  assert.equal(recordStatus('Contacts', {}), '');
});

test('the lead pipeline runs New to Closed without the off-path stages', () => {
  assert.deepEqual(leadStages, [
    'New',
    'Contacted',
    'Qualified',
    'Viewing',
    'Negotiation',
    'Documentation',
    'Closed',
  ]);
});

test('the stage track marks earlier stages done and the saved stage current', () => {
  const track = stageTrack(' viewing ');
  assert.equal(track.stage, 'Viewing');
  assert.equal(track.position, 4);
  assert.equal(track.total, 7);
  assert.equal(track.offPath, '');
  assert.deepEqual(states(track), ['done', 'done', 'done', 'current', 'todo', 'todo', 'todo']);
  assert.deepEqual(states(stageTrack('New')).slice(0, 2), ['current', 'todo']);
  assert.deepEqual(states(stageTrack('Closed')), [...Array(6).fill('done'), 'current']);
});

test('Lost, On hold, imported values and a blank stage mark no step', () => {
  for (const value of ['Lost', 'On hold', 'Hot prospect']) {
    const track = stageTrack(value);
    assert.equal(track.offPath, value);
    assert.equal(track.position, 0);
    assert.ok(states(track).every((state) => state === 'todo'));
  }
  const blank = stageTrack(undefined);
  assert.deepEqual([blank.stage, blank.offPath, blank.position], ['', '', 0]);
  assert.ok(states(blank).every((state) => state === 'todo'));
});
