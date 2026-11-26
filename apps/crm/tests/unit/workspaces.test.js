import assert from 'node:assert/strict';
import test from 'node:test';
import { initialTeam, memberProfile, setupOwner, canVisit } from '../../src/features/team/model.js';
import {
  resolveWorkspace,
  workspaceStorageKey,
  workspaceUrl,
} from '../../src/features/workspaces/model.js';
import { createScopedWorkspaceRepository } from '../../src/services/storage/workspaceRepository.js';
import { createScopedPreferencesRepository } from '../../src/services/storage/preferencesRepository.js';
import { SUPER_WORKSPACE_ID, MAX_ACTIVITY_ENTRIES } from '../../src/config/workspaces.js';
import { DEMO_PASSWORD } from '../../src/config/demoAccounts.js';
import { blank } from '../../src/lib/schema.js';
import { appendActivity, selectActivity } from '../../src/features/activity/model.js';
import { normalizeEnvelope } from '../../src/lib/validation.js';

const storage = (initial = []) => {
  const entries = new Map(initial);
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
};

test('roles control modules while workspace access remains personal for every non-owner', () => {
  const team = initialTeam();
  const aidah = memberProfile(team, 'aidah');
  assert.equal(resolveWorkspace(team, aidah).id, 'aidah');
  assert.throws(() => resolveWorkspace(team, aidah, 'simoni'), /only open your own/);
  assert.throws(() => resolveWorkspace(team, aidah, SUPER_WORKSPACE_ID), /only open your own/);
  assert.equal(canVisit(aidah, 'Workspaces'), false);
  assert.equal(canVisit(aidah, 'Team activity'), true);
  assert.equal(canVisit(aidah, 'Deals'), true);
  assert.match(
    workspaceUrl('Clients', 'aidah', 'name & email'),
    /workspace=aidah&q=name\+%26\+email/,
  );
});

test('the Super Admin can resolve the old organisation store and all member workspaces', () => {
  const team = setupOwner(
    initialTeam(),
    {
      name: 'Simoni',
      email: 'simoni@keyswithsimoni.test',
      phone: '+971501234567',
      password: DEMO_PASSWORD,
      confirmPassword: DEMO_PASSWORD,
    },
    'simoni',
  ).team;
  const owner = memberProfile(team, 'simoni');
  assert.equal(resolveWorkspace(team, owner).id, SUPER_WORKSPACE_ID);
  assert.equal(resolveWorkspace(team, owner, 'aidah').id, 'aidah');
  assert.throws(() => resolveWorkspace(team, owner, 'unknown'), /could not be found/);
  assert.equal(workspaceStorageKey(SUPER_WORKSPACE_ID), 'kws-crm-v1');
  assert.notEqual(workspaceStorageKey('aidah'), workspaceStorageKey('simoni'));
});

test('the legacy workspace stays byte-for-byte intact while personal records are saved independently', () => {
  const data = blank();
  data.Clients = [{ client_id: 'CL-001', full_name: 'Existing organisation client' }];
  const old = JSON.stringify({ data, demo: false, customMetadata: { legacy: true } });
  const memory = storage([['kws-crm-v1', old]]);
  const aidah = createScopedWorkspaceRepository('aidah', () => memory);
  assert.equal(
    aidah.load().data.Clients.some((row) => row.full_name === 'Existing organisation client'),
    false,
  );
  const personal = { data: blank(), demo: false };
  personal.data.Clients = [{ client_id: 'CL-001', full_name: 'Aidah client' }];
  aidah.save(personal);
  assert.equal(memory.getItem('kws-crm-v1'), old);
  assert.equal(
    createScopedWorkspaceRepository('simoni', () => memory).load().data.Clients.length,
    0,
  );
  assert.deepEqual(
    createScopedWorkspaceRepository(SUPER_WORKSPACE_ID, () => memory).load(),
    JSON.parse(old),
  );
  assert.equal(aidah.load().data.Clients[0].full_name, 'Aidah client');
});

test('targets remain scoped while theme changes preserve the organisation targets', () => {
  const memory = storage([
    ['kws-crm-preferences', JSON.stringify({ theme: 'dark', targets: { organisation: 100 } })],
  ]);
  const aidah = createScopedPreferencesRepository('aidah', () => memory);
  const simoni = createScopedPreferencesRepository('simoni', () => memory);
  aidah.save({ theme: 'light', targets: { personal: 20 } });
  assert.deepEqual(aidah.load().targets, { personal: 20 });
  assert.deepEqual(simoni.load().targets, {});
  assert.equal(simoni.load().theme, 'light');
  assert.deepEqual(JSON.parse(memory.getItem('kws-crm-preferences')).targets, {
    organisation: 100,
  });
});

test('activity stays in its own envelope, preserves actor and workspace, and filters by Dubai date', () => {
  const user = { id: 'simoni', name: 'Simoni' };
  const original = { data: blank(), demo: false };
  const saved = appendActivity(
    original,
    user,
    'aidah',
    {
      action: 'update',
      module: 'Clients',
      recordId: 'CL-001',
      label: 'Aidah client',
      fields: ['Full name'],
    },
    { now: Date.parse('2026-10-08T21:30:00Z'), id: 'event-1' },
  );
  assert.equal(original.activity, undefined);
  assert.deepEqual(saved.data, original.data);
  assert.equal(saved.activity[0].actorId, 'simoni');
  const snapshots = [
    { owner: { id: 'aidah', name: 'Aidah' }, workspace: saved },
    { owner: { id: 'simoni', name: 'Simoni' }, workspace: saved },
  ];
  assert.equal(selectActivity(snapshots).length, 1);
  assert.equal(
    selectActivity(snapshots, { from: '2026-10-09', to: '2026-10-09', actor: 'simoni' }).length,
    1,
  );
  assert.equal(selectActivity(snapshots, { workspace: 'simoni' }).length, 0);
  assert.deepEqual(normalizeEnvelope(saved), saved);
  assert.throws(() => normalizeEnvelope({ ...saved, activity: [{}] }), /activity history/);
});

test('recent history caps at 500 entries and failed writes do not partially persist records or activity', () => {
  const user = { id: 'aidah', name: 'Aidah' };
  let envelope = { data: blank(), demo: false };
  for (let index = 0; index <= MAX_ACTIVITY_ENTRIES; index++)
    envelope = appendActivity(
      envelope,
      user,
      'aidah',
      { action: 'create', module: 'Clients', recordId: `CL-${index}` },
      { now: index, id: `event-${index}` },
    );
  assert.equal(envelope.activity.length, MAX_ACTIVITY_ENTRIES);
  assert.equal(envelope.activity.at(-1).id, 'event-1');
  const memory = storage();
  const repository = createScopedWorkspaceRepository('aidah', () => memory);
  repository.save(envelope);
  const before = memory.getItem(workspaceStorageKey('aidah'));
  memory.setItem = () => {
    throw Error('Quota');
  };
  assert.throws(
    () =>
      repository.save(
        appendActivity(
          envelope,
          user,
          'aidah',
          { action: 'delete', module: 'Clients' },
          { id: 'failed', now: 1000 },
        ),
      ),
    /Quota/,
  );
  assert.equal(memory.getItem(workspaceStorageKey('aidah')), before);
});
