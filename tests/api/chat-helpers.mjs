import assert from 'node:assert/strict';
import { activate, invite } from './team-helpers.mjs';

/** Shared calls for the team chat group and mention suites (packet C3). */
export const chatPath = (session, suffix = '') =>
  `/workspaces/${session.user.workspaceId}/chat${suffix}`;

export const rooms = async (session) => (await session.request(chatPath(session))).value;

export const roomOf = async (session, id) =>
  (await rooms(session)).rooms.find((room) => room.id === id);

export const summary = async (session) =>
  (await session.request(chatPath(session, '/summary'))).value;

export const send = (session, room, body, extra = {}) =>
  session.request(chatPath(session, `/rooms/${room}/messages`), {
    method: 'POST',
    body: { body, ...extra },
  });

export const messages = async (session, room) =>
  (await session.request(chatPath(session, `/rooms/${room}/messages`))).value.messages;

export const markRead = (session, room) =>
  session.request(chatPath(session, `/rooms/${room}/read`), { method: 'POST' });

export const leave = (session, room) =>
  session.request(chatPath(session, `/rooms/${room}/leave`), { method: 'POST' });

export const startGroup = (session, memberIds, name) =>
  session.request(chatPath(session, '/groups'), {
    method: 'POST',
    body: name === undefined ? { memberIds } : { memberIds, name },
  });

/** A live staff member of `admin`'s company with a synthetic address. */
export const staff = async (admin, suffix) => activate(await invite(admin, suffix));

/** A group of `creator` with `members` (sessions); returns the new room. */
export async function group(creator, members, name) {
  const made = await startGroup(
    creator,
    members.map((member) => member.user.id),
    name,
  );
  assert.equal(made.status, 201, JSON.stringify(made.value));
  return made.value.room;
}

export const general = async (session) =>
  (await rooms(session)).rooms.find((room) => room.name === 'general');
