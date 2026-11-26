import test from 'node:test';
import assert from 'node:assert/strict';
import {
  avatarTone,
  detailsFieldError,
  initials,
} from '../../src/features/server/profile/profileModel.js';
import {
  deviceKind,
  relativeTime,
  sortSessions,
} from '../../src/features/server/profile/sessionModel.js';

test('avatar initials and tones are stable for synthetic members', () => {
  assert.equal(initials('Synthetic Member One'), 'SM');
  assert.equal(initials('  aidah '), 'A');
  assert.equal(initials(''), '?');
  assert.equal(avatarTone('member-a'), avatarTone('member-a'));
  assert.ok([0, 1, 2, 3].includes(avatarTone('member-b')));
});

test('details fields validate one at a time', () => {
  const form = { name: ' ', phone: '0501234567' };
  assert.equal(detailsFieldError('name', form).field, 'name');
  assert.match(detailsFieldError('phone', form).message, /country code/);
  assert.equal(detailsFieldError('phone', { phone: '+971501234567' }), null);
});

test('sessions show device kind, relative times and this device first', () => {
  assert.equal(deviceKind({ device: 'Safari · iOS' }), 'mobile');
  assert.equal(deviceKind({ device: 'Chrome · Android' }), 'mobile');
  assert.equal(deviceKind({ device: 'Chrome · macOS' }), 'desktop');
  assert.equal(deviceKind({ device: null }), 'desktop');
  const now = Date.parse('2026-10-15T12:00:00Z');
  const ago = (ms) => new Date(now - ms).toISOString();
  assert.equal(relativeTime(ago(20 * 1000), now), 'just now');
  assert.equal(relativeTime(ago(5 * 60 * 1000), now), '5 min ago');
  assert.equal(relativeTime(ago(60 * 60 * 1000), now), '1 hour ago');
  assert.equal(relativeTime(ago(3 * 24 * 60 * 60 * 1000), now), '3 days ago');
  assert.match(relativeTime(ago(10 * 24 * 60 * 60 * 1000), now), /2026/);
  assert.equal(relativeTime('not a date', now), '');
  const sorted = sortSessions([
    { id: 'old', lastSeenAt: ago(9000) },
    { id: 'mine', current: true, lastSeenAt: ago(99999) },
    { id: 'new', lastSeenAt: ago(1000) },
  ]);
  assert.deepEqual(
    sorted.map((session) => session.id),
    ['mine', 'new', 'old'],
  );
});
