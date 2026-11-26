import assert from 'node:assert/strict';
import { teamPath } from './team-helpers.mjs';

export async function archiveReview(actor, scope, member) {
  const path = `${teamPath(scope, member.id)}/archive-preview`;
  const response = await actor.request(path);
  assert.equal(response.status, 200, JSON.stringify(response.value));
  assert.equal(response.value.member.id, member.id);
  assert.equal(typeof response.value.teamFingerprint, 'string');
  return response.value;
}

export function archiveBody(review, overrides = {}) {
  return {
    version: review.member.version,
    confirmationEmail: review.member.email,
    teamFingerprint: review.teamFingerprint,
    ...overrides,
  };
}

export function archive(actor, scope, review, overrides = {}) {
  return actor.request(teamPath(scope, review.member.id), {
    method: 'DELETE',
    body: archiveBody(review, overrides),
  });
}
