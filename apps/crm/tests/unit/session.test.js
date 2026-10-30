import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMO_PASSWORD, DEMO_SESSION_KEY, demoAdmins } from '../../src/config/demoAccounts.js';
import { demoAdminProfile, signInDemo, validateSignIn } from '../../src/services/auth/demoAuth.js';
import { createSessionRepository } from '../../src/services/storage/sessionRepository.js';

function memoryStorage() {
  const entries = new Map();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
}

test('both named demo admins have identical access, with normalized emails and exact passwords', () => {
  for (const account of demoAdmins) {
    const profile = signInDemo(` ${account.email.toUpperCase()} `, DEMO_PASSWORD);
    assert.equal(profile.name, account.name);
    assert.equal(profile.role, 'Admin');
    assert.equal(profile.email, account.email);
    assert.equal('password' in profile, false);
    assert.throws(() => signInDemo(account.email, 'incorrect'), /Email or password is incorrect/);
    assert.throws(() => signInDemo(account.email, `${DEMO_PASSWORD} `), /incorrect/);
  }
  assert.throws(() => signInDemo('unknown@example.com', DEMO_PASSWORD), /incorrect/);
  assert.equal(demoAdminProfile('unknown'), null);
});

test('sign-in validation identifies missing and malformed fields without changing the password', () => {
  assert.deepEqual(Object.keys(validateSignIn(' ', '')), ['email', 'password']);
  assert.deepEqual(validateSignIn('invalid email', DEMO_PASSWORD), {
    email: 'Enter a valid email address.',
  });
  assert.deepEqual(validateSignIn(demoAdmins[0].email, DEMO_PASSWORD), {});
});

test('sessions save identity only and signing out preserves CRM data and theme preferences', () => {
  const storage = memoryStorage();
  storage.setItem('kws-crm-v1', 'existing records and property media');
  storage.setItem('kws-crm-preferences', 'saved theme and targets');
  const repository = createSessionRepository(() => storage);
  assert.equal(repository.load(), null);
  repository.save(demoAdmins[0].id);
  assert.deepEqual(JSON.parse(storage.getItem(DEMO_SESSION_KEY)), {
    version: 1,
    adminId: demoAdmins[0].id,
  });
  assert.deepEqual(repository.load(), demoAdminProfile(demoAdmins[0].id));
  repository.clear();
  assert.equal(repository.load(), null);
  assert.equal(storage.getItem('kws-crm-v1'), 'existing records and property media');
  assert.equal(storage.getItem('kws-crm-preferences'), 'saved theme and targets');
});

test('invalid sessions cannot invent accounts, names or roles', () => {
  const storage = memoryStorage();
  const repository = createSessionRepository(() => storage);
  for (const raw of [
    '{broken',
    'null',
    'false',
    '{}',
    '{"version":99,"adminId":"aidah"}',
    '{"version":1,"adminId":"unknown"}',
  ]) {
    storage.setItem(DEMO_SESSION_KEY, raw);
    assert.equal(repository.load(), null);
  }
  storage.setItem(
    DEMO_SESSION_KEY,
    JSON.stringify({ version: 1, adminId: 'aidah', name: 'Someone else', role: 'Owner' }),
  );
  assert.deepEqual(repository.load(), demoAdminProfile('aidah'));
  assert.throws(() => repository.save('unknown'), /Unknown demo account/);
});

test('session storage is accessed lazily and failures propagate without successful persistence', () => {
  let accesses = 0;
  const repository = createSessionRepository(() => {
    accesses++;
    throw new DOMException('Blocked', 'SecurityError');
  });
  assert.equal(accesses, 0);
  assert.equal(repository.load(), null);
  assert.throws(() => repository.save('aidah'), /Blocked/);
  assert.throws(() => repository.clear(), /Blocked/);
  assert.equal(accesses, 3);
});
