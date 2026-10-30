import assert from 'node:assert/strict';
import test from 'node:test';
import { hasTeamFeatures } from '../../src/features/server/access.js';
import {
  checklistStorageKey,
  deriveGettingStarted,
  hideChecklist,
  readChecklistHidden,
} from '../../src/features/server/dashboard/getStartedModel.js';
import {
  companyDraft,
  companyDraftError,
  companyDraftPayload,
} from '../../src/features/server/profile/companyProfileModel.js';

// Companies are universal (B0, docs/deepseek-delivery-plan.md §3): the retired individual
// Company access follows the signed-in role throughout the connected CRM.
test('team features follow management access alone', () => {
  assert.equal(hasTeamFeatures({ roleId: 'admin' }), true);
  assert.equal(hasTeamFeatures({ roleId: 'super-admin' }), true);
  assert.equal(hasTeamFeatures({ roleId: 'staff' }), false);
  assert.equal(hasTeamFeatures(undefined), false);
});

test('get-started tasks always include the team step', () => {
  const data = { Properties: [{}], Clients: [], 'Follow-ups': [] };
  assert.deepEqual(
    deriveGettingStarted(data, { setupComplete: false }).map(({ id, complete }) => [id, complete]),
    [
      ['property', true],
      ['client', false],
      ['followUp', false],
      ['company', false],
      ['team', false],
    ],
  );
  assert.deepEqual(
    deriveGettingStarted(data, { setupComplete: true }).map(({ id }) => id),
    ['property', 'client', 'followUp', 'team'],
  );
});

test('checklist preference is scoped and storage failures stay harmless', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  hideChecklist('workspace-a', storage);
  assert.equal(readChecklistHidden('workspace-a', storage), true);
  assert.equal(readChecklistHidden('workspace-b', storage), false);
  assert.notEqual(checklistStorageKey('workspace-a'), checklistStorageKey('workspace-b'));
  const blocked = {
    getItem: () => {
      throw Error('blocked');
    },
    setItem: () => {
      throw Error('blocked');
    },
  };
  assert.equal(readChecklistHidden('workspace-a', blocked), false);
  assert.doesNotThrow(() => hideChecklist('workspace-a', blocked));
});

test('company profile drafts validate and preserve the company version', () => {
  const company = { displayName: 'Old name', emirate: 'dubai', version: 4 };
  assert.deepEqual(companyDraft(company), { displayName: 'Old name', emirate: 'dubai' });
  assert.deepEqual(companyDraftError({ displayName: 'Firm', emirate: '' }), [
    'emirate',
    'signupErrors.invalidCompany',
  ]);
  assert.deepEqual(
    companyDraftPayload(company, { displayName: ' New firm ', emirate: 'sharjah' }),
    { version: 4, displayName: 'New firm', emirate: 'sharjah' },
  );
});
