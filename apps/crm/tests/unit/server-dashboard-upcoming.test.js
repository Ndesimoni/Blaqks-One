import test from 'node:test';
import assert from 'node:assert/strict';
import {
  showsListingViewings,
  upcomingEntries,
  viewingClock,
} from '../../src/features/server/dashboard/upcomingModel.js';
import { dubaiDayFromToday } from '../../src/lib/dubaiDate.js';

const at = (days, time) => `${dubaiDayFromToday(days)} ${time}`;
const own = (id, when) => ({
  viewing_id: id,
  client_id: 'CL-1',
  property_id: 'PR-1',
  appointment_date_time: when,
});
const held = (when, agent = { id: 'u2', name: 'Agent Two' }) => ({
  property_id: 'PR-9',
  appointment_date_time: when,
  agent,
  // Fields the server never sends; the model must not pass them on even if they appear.
  client_id: 'CL-SECRET',
  full_name: 'Secret buyer',
  viewing_status: 'Booked',
  feedback: 'Private feedback',
  next_action: 'Private next step',
  id: 'uuid-secret',
  viewing_id: 'VW-SECRET',
});

test('held-listing entries merge with own viewings in appointment order', () => {
  const upcoming = [own('VW-1', at(1, '09:00')), own('VW-2', at(3, '09:00'))];
  const entries = upcomingEntries(upcoming, [held(at(2, '14:30'))], true, 5);
  assert.deepEqual(
    entries.map((entry) => entry.kind),
    ['own', 'held', 'own'],
  );
  assert.equal(entries[0].record, upcoming[0]);
});

test('ties keep own viewings first and the merged list respects the panel limit', () => {
  const upcoming = [own('VW-1', at(1, '10:00')), own('VW-2', at(4, '10:00'))];
  const entries = upcomingEntries(upcoming, [held(at(1, '10:00')), held(at(2, '08:00'))], true);
  assert.equal(entries.length, 3);
  assert.deepEqual(
    entries.map((entry) => entry.kind),
    ['own', 'held', 'held'],
  );
});

test('held entries outside the upcoming window or without a time are left out', () => {
  const entries = upcomingEntries(
    [],
    [held(at(-2, '10:00')), held(null), held('not a date'), held(at(0, '09:00'))],
    true,
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0].at, at(0, '09:00'));
});

test('held entries carry only time, property and agent; never client or viewing fields', () => {
  const [entry, queued] = upcomingEntries(
    [],
    [held(at(1, '11:00')), held(at(2, '11:00'), null)],
    true,
  );
  assert.deepEqual(entry, {
    kind: 'held',
    at: at(1, '11:00'),
    propertyId: 'PR-9',
    agentName: 'Agent Two',
  });
  assert.equal(queued.agentName, null);
  const text = JSON.stringify([entry, queued]);
  for (const secret of ['CL-SECRET', 'Secret buyer', 'Booked', 'Private', 'uuid-secret', 'VW-'])
    assert.equal(text.includes(secret), false, secret);
});

test('held entries are excluded when the dashboard shows another member or the queue', () => {
  const upcoming = [own('VW-1', at(1, '09:00'))];
  const items = [held(at(1, '12:00'))];
  assert.equal(showsListingViewings('', 'me'), true);
  assert.equal(showsListingViewings('me', 'me'), true);
  assert.equal(showsListingViewings('other', 'me'), false);
  assert.equal(showsListingViewings('queue', 'me'), false);
  const filtered = upcomingEntries(upcoming, items, showsListingViewings('other', 'me'));
  assert.deepEqual(
    filtered.map((entry) => entry.kind),
    ['own'],
  );
  assert.deepEqual(upcomingEntries(upcoming, undefined, true).length, 1);
});

test('team-scope callers receive an empty projection, so nothing is duplicated', () => {
  const upcoming = [own('VW-1', at(1, '09:00')), own('VW-2', at(2, '09:00'))];
  assert.deepEqual(
    upcomingEntries(upcoming, [], true).map((entry) => entry.record),
    upcoming,
  );
});

test('the clock shows the stored time or a plain label', () => {
  assert.equal(viewingClock('2099-01-02 10:05'), '10:05');
  assert.equal(viewingClock('2099-01-02T07:30:00'), '07:30');
  assert.equal(viewingClock('2099-01-02'), 'Time not set');
  assert.equal(viewingClock(null), 'Time not set');
});
