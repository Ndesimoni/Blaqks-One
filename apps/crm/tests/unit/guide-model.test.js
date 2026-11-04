import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findGuides,
  groupGuides,
  guides,
  readMinutes,
  relatedGuides,
  topics,
  visibleGuides,
} from '../../src/features/server/guide/guideModel.js';

const admin = { roleId: 'admin', permissions: {}, channelAccess: {} };

test('every article has a known topic, a unique id and lines to read', () => {
  assert.equal(new Set(guides.map((guide) => guide.id)).size, guides.length);
  for (const guide of guides) {
    assert.ok(topics.includes(guide.topic), guide.id);
    assert.ok((guide.steps || guide.points).length >= 3, guide.id);
    assert.ok(readMinutes(guide) >= 1);
  }
});

test('search matches every word, within the chosen topic', () => {
  assert.deepEqual(
    findGuides(guides, null, 'whatsapp number').map((guide) => guide.id),
    ['whatsapp-number'],
  );
  assert.deepEqual(findGuides(guides, 'Websites', 'shortlist'), []);
  const crm = findGuides(guides, 'CRM', '');
  assert.ok(crm.length > 5 && crm.every((guide) => guide.topic === 'CRM'));
});

test('groups follow the topic order and related guides start with the same topic', () => {
  assert.deepEqual(
    groupGuides(guides).map((group) => group.topic),
    topics,
  );
  const first = guides.find((guide) => guide.id === 'first-client');
  const related = relatedGuides(guides, first);
  assert.equal(related.length, 3);
  assert.ok(related.every((guide) => guide.topic === 'CRM' && guide.id !== first.id));
});

test('task articles show only where their section opens; rule articles always', () => {
  const staff = { roleId: 'staff', permissions: {}, channelAccess: {} };
  const seen = visibleGuides(staff).map((guide) => guide.id);
  assert.ok(seen.includes('who-sees'));
  assert.ok(!seen.includes('first-client') && !seen.includes('invite'));
  assert.ok(visibleGuides(admin).some((guide) => guide.id === 'invite'));
});
