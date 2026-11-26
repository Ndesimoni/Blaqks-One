import assert from 'node:assert/strict';
import test from 'node:test';
import { blank } from '../../src/lib/schema.js';
import {
  dubaiInstant,
  calendarSnapshot,
  scheduleErrors,
  selectCalendarEntries,
} from '../../src/features/calendar/selectors.js';
import { saveWorkspaceRecord } from '../../src/features/records/commands.js';
import { createFullBackup, parseFullBackup } from '../../src/services/files/backup.js';

test('Dubai appointments preserve wall-clock time across host zones and reject impossible dates', () => {
  assert.equal(dubaiInstant('2026-10-09T10:30'), '2026-10-09T06:30:00.000Z');
  assert.equal(dubaiInstant('2026-10-09T00:15'), '2026-10-08T20:15:00.000Z');
  for (const value of [
    '2026-02-30T10:00',
    '2026-10-09T24:00',
    '2026-10-09T10:60',
    '2026-10-09T10:00:60',
    'invalid',
  ])
    assert.equal(dubaiInstant(value), null);
});

test('the calendar combines viewings and calls, retains date-only tasks, and sends only enabled open activities', () => {
  const data = blank();
  data.Clients = [
    { client_id: 'CL-1', full_name: 'Calendar Client', email: 'client@example.test' },
  ];
  data.Viewings = [
    {
      viewing_id: 'VW-1',
      client_id: 'CL-1',
      appointment_date_time: '2026-10-09T10:30',
      calendar_enabled: 'Yes',
      calendar_duration: '60',
    },
  ];
  data['Follow-ups'] = [
    {
      activity_id: 'FU-1',
      client_id: 'CL-1',
      due_date: '2026-10-09',
      calendar_enabled: 'Yes',
      calendar_activity: 'Call',
      calendar_start: '2026-10-09T15:00',
      calendar_reminder: '30',
    },
    { activity_id: 'FU-2', due_date: '2026-10-10', calendar_enabled: 'Yes' },
    {
      activity_id: 'FU-3',
      due_date: '2026-10-09',
      calendar_enabled: 'Yes',
      task_status: 'Completed',
    },
    { activity_id: 'FU-4', due_date: '2026-10-09' },
  ];
  const before = structuredClone(data);
  assert.equal(selectCalendarEntries(data).length, 5);
  const events = calendarSnapshot(data, true);
  assert.equal(events.length, 3);
  const viewing = events.find((event) => event.key === 'Viewings:VW-1');
  assert.equal(viewing.start.dateTime, '2026-10-09T06:30:00.000Z');
  assert.equal(viewing.end.dateTime, '2026-10-09T07:30:00.000Z');
  assert.equal(viewing.start.timeZone, 'Asia/Dubai');
  assert.deepEqual(viewing.attendees, []);
  const allDay = events.find((event) => event.key === 'Follow-ups:FU-2');
  assert.deepEqual(allDay.start, { date: '2026-10-10' });
  assert.deepEqual(allDay.end, { date: '2026-10-11' });
  assert.equal(events.find((event) => event.key === 'Follow-ups:FU-1').reminderMinutes, 30);
  assert.deepEqual(data, before);
});

test('invitations require an explicit choice and a linked client email, and schedules validate before saving', () => {
  const data = blank();
  data.Clients = [{ client_id: 'CL-1', email: 'client@example.test' }];
  const record = {
    activity_id: 'FU-1',
    client_id: 'CL-1',
    calendar_enabled: 'Yes',
    calendar_activity: 'Meeting',
    calendar_start: '2026-10-09T10:30',
    calendar_duration: '30',
    calendar_invite: 'Yes',
  };
  assert.deepEqual(scheduleErrors('Follow-ups', record, data), {});
  data['Follow-ups'] = [record];
  assert.deepEqual(calendarSnapshot(data)[0].attendees, [{ email: 'client@example.test' }]);
  assert.ok(
    scheduleErrors('Follow-ups', { ...record, client_id: 'CL-MISSING' }, data).calendar_invite,
  );
  assert.ok(scheduleErrors('Follow-ups', { ...record, calendar_start: '' }, data).calendar_start);
  for (const duration of ['0', '1.5', '1441', 'invalid']) {
    const invalid = { ...record, calendar_duration: duration };
    assert.ok(
      saveWorkspaceRecord({ data }, 'Follow-ups', invalid, record).errors.calendar_duration,
    );
    data['Follow-ups'] = [invalid];
    assert.deepEqual(calendarSnapshot(data), []);
  }
});

test('scheduling metadata survives full JSON backups without adding workbook collections', () => {
  const data = blank();
  data['Follow-ups'] = [
    {
      activity_id: 'FU-1',
      calendar_enabled: 'Yes',
      calendar_start: '2026-10-09T10:00',
      calendar_duration: '30',
      calendar_invite: 'No',
    },
  ];
  const restored = parseFullBackup(JSON.stringify(createFullBackup(data)));
  assert.deepEqual(restored, data);
  assert.equal(Object.keys(restored).length, 11);
  assert.throws(
    () =>
      parseFullBackup(
        JSON.stringify(
          createFullBackup({
            ...data,
            'Follow-ups': [{ activity_id: 'FU-1', calendar_start: {} }],
          }),
        ),
      ),
    /must be a text or number/,
  );
});
