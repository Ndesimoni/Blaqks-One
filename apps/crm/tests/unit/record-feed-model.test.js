import assert from 'node:assert/strict';
import test from 'node:test';
import {
  channelKind,
  dayCounts,
  dayLabelKey,
  feedMoment,
  feedWay,
  groupFeed,
  orderFeed,
} from '../../src/features/records/feed/feedModel.js';

// Synthetic Interaction log entries; only the stored keys the feed reads.
const log = (log_id, contacted_on_uae_time) => ({ log_id, contacted_on_uae_time });

test('a contact moment is read as stored UAE text, with or without a time', () => {
  assert.deepEqual(feedMoment('2026-10-31 09:40'), { day: '2026-10-31', time: '09:40' });
  assert.deepEqual(feedMoment('2026-10-31T18:05'), { day: '2026-10-31', time: '18:05' });
  assert.deepEqual(feedMoment(' 2026-10-30 '), { day: '2026-10-30', time: '' });
  for (const value of ['', null, undefined, 'next week', '31/10/2026'])
    assert.deepEqual(feedMoment(value), { day: '', time: '' });
});

test('the feed runs newest first and keeps undated conversations, in their order, at the end', () => {
  const records = [
    log('LG-1', '2026-10-29 10:00'),
    log('LG-2', ''),
    log('LG-3', '2026-10-31 09:40'),
    log('LG-4', '2026-10-31'),
    log('LG-5', 'not a date'),
    log('LG-6', '2026-10-31 18:05'),
  ];
  const before = structuredClone(records);
  const ids = orderFeed(records).map((record) => record.log_id);
  assert.deepEqual(ids, ['LG-6', 'LG-3', 'LG-4', 'LG-1', 'LG-2', 'LG-5']);
  assert.deepEqual(records, before, 'ordering never changes the stored records');
});

test('conversations group by contact day and each day counts every filtered record', () => {
  const ordered = orderFeed([
    log('LG-1', '2026-10-31 09:00'),
    log('LG-2', '2026-10-30 12:00'),
    log('LG-3', '2026-10-31 11:00'),
    log('LG-4', ''),
  ]);
  const groups = groupFeed(ordered);
  assert.deepEqual(
    groups.map((group) => [group.day, group.records.map((record) => record.log_id)]),
    [
      ['2026-10-31', ['LG-3', 'LG-1']],
      ['2026-10-30', ['LG-2']],
      ['', ['LG-4']],
    ],
  );
  const counts = dayCounts(ordered);
  assert.equal(counts.get('2026-10-31'), 2);
  assert.equal(counts.get(''), 1);
  // A page holding part of a day still states the day's full count.
  assert.equal(groupFeed(ordered.slice(1))[0].records.length, 1);
});

test('day headings name today, yesterday and undated conversations', () => {
  assert.equal(dayLabelKey('2026-10-31', '2026-10-31', '2026-10-30'), 'today');
  assert.equal(dayLabelKey('2026-10-30', '2026-10-31', '2026-10-30'), 'yesterday');
  assert.equal(dayLabelKey('2026-10-01', '2026-10-31', '2026-10-30'), '');
  assert.equal(dayLabelKey('', '2026-10-31', '2026-10-30'), 'noDate');
});

test('each workbook channel has its icon and custom channels fall back to a note', () => {
  const kinds = ['WhatsApp', 'Phone', 'Email', 'SMS', 'In-person', 'Other'].map(channelKind);
  assert.deepEqual(kinds, ['whatsapp', 'phone', 'mail', 'sms', 'meeting', 'note']);
  assert.equal(channelKind(' whatsapp call '), 'whatsapp');
  assert.equal(channelKind('E-mail'), 'mail');
  assert.equal(channelKind(undefined), 'note');
  assert.equal(channelKind('Instagram'), 'note');
});

test("a title joins channel and client as the mockup's feed does", () => {
  assert.equal(feedWay('phone', 'Outbound'), 'with');
  assert.equal(feedWay('meeting', 'Inbound'), 'with');
  assert.equal(feedWay('mail', 'Outbound'), 'to');
  assert.equal(feedWay('whatsapp', 'Inbound'), 'from');
  assert.equal(feedWay('sms', ''), 'with');
  assert.equal(feedWay('note', undefined), 'with');
});
