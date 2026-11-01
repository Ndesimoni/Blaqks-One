import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activityModules,
  selectRecordTimeline,
  timeOfDay,
} from '../../src/features/records/panel/timelineModel.js';

const client = { client_id: 'CL-1', full_name: 'Layla Haddad' };
const data = {
  Properties: [{ property_id: 'PR-1', listing_title: 'Marina Gate 2-bed' }],
  'Follow-ups': [
    {
      activity_id: 'FU-1',
      client_id: 'CL-1',
      contact_date: '2026-10-20',
      channel: 'Call',
      next_action: 'Send the shortlist',
      outcome_notes: 'Wants a sea view.',
      task_status: 'Open',
    },
    { activity_id: 'FU-2', client_id: 'CL-2', contact_date: '2026-10-30', next_action: 'Other' },
    { activity_id: 'FU-3', client_id: ' CL-1 ', due_date: '2026-10-25', next_action: 'Due only' },
  ],
  Viewings: [
    {
      viewing_id: 'VW-1',
      client_id: 'CL-1',
      property_id: 'PR-1',
      appointment_date_time: '2026-10-28T17:00',
      viewing_status: 'Confirmed',
      client_feedback: 'Liked the balcony.',
    },
  ],
  'Interaction log': [
    {
      log_id: 'LG-1',
      client_id: 'CL-1',
      contacted_on_uae_time: '2026-10-27T09:40',
      channel: 'WhatsApp',
      direction: 'Inbound',
      conversation_topic: 'Availability',
      conversation_summary_client_needs: 'Asked if the flat is free.',
      action_status: 'Done',
    },
  ],
  'Client care': [
    {
      care_id: 'CA-1',
      client_id: 'CL-1',
      touchpoint_type: 'Birthday',
      last_contact: '',
      next_contact: '',
      conversation_notes: 'Card sent.',
    },
  ],
};

test('a client timeline merges four collections, newest first and undated last', () => {
  const entries = selectRecordTimeline(data, client);
  assert.deepEqual(
    entries.map((entry) => entry.key),
    [
      'Viewings:0:VW-1',
      'Interaction log:0:LG-1',
      'Follow-ups:1:FU-3',
      'Follow-ups:0:FU-1',
      'Client care:0:CA-1',
    ],
  );
  assert.deepEqual(entries[0], {
    key: 'Viewings:0:VW-1',
    module: 'Viewings',
    kind: 'viewing',
    icon: 'eye',
    date: '2026-10-28T17:00',
    label: '',
    title: 'Marina Gate 2-bed',
    detail: 'Liked the balcony.',
    status: 'Confirmed',
  });
  assert.equal(entries[1].label, 'WhatsApp · Inbound');
  assert.equal(entries[1].title, 'Availability');
  assert.equal(entries[3].detail, 'Wants a sea view.');
  assert.equal(entries[4].label, 'Birthday');
  assert.equal(entries[4].date, '');
});

test('other clients, blank client IDs and hidden collections stay out', () => {
  const keys = selectRecordTimeline(data, client).map((entry) => entry.key);
  assert.ok(!keys.some((key) => key.includes('FU-2')));
  assert.deepEqual(selectRecordTimeline(data, { client_id: ' ' }), []);
  assert.deepEqual(selectRecordTimeline(data, null), []);
  const schedule = selectRecordTimeline(data, client, (module) => module === 'Viewings');
  assert.deepEqual(
    schedule.map((entry) => entry.module),
    ['Viewings'],
  );
  assert.deepEqual(activityModules, ['Follow-ups', 'Viewings', 'Interaction log', 'Client care']);
});

test('missing collections and unknown properties still give readable entries', () => {
  const sparse = {
    Viewings: [{ viewing_id: 'VW-9', client_id: 'CL-1', property_id: 'PR-404' }],
  };
  const [viewing] = selectRecordTimeline(sparse, client);
  assert.equal(viewing.title, 'PR-404');
  const noProperty = selectRecordTimeline({ Viewings: [{ client_id: 'CL-1' }] }, client);
  assert.equal(noProperty[0].title, '');
});

test('times come only from date-and-time values', () => {
  assert.equal(timeOfDay('2026-10-28T17:00'), '17:00');
  assert.equal(timeOfDay('2099-03-04 11:00'), '11:00');
  assert.equal(timeOfDay('2026-10-28'), '');
  assert.equal(timeOfDay('Call at 17:00'), '');
  assert.equal(timeOfDay(undefined), '');
});
