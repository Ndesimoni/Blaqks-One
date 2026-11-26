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
  companyErrors,
  companyPayload,
  draftChanged,
} from '../../src/features/server/company/companyModel.js';

// Companies are universal (B0, docs/deepseek-delivery-plan.md §3): the retired individual
// Company access follows the signed-in role throughout the connected CRM.
test('team features follow management access alone', () => {
  assert.equal(hasTeamFeatures({ roleId: 'admin' }), true);
  assert.equal(hasTeamFeatures({ roleId: 'super-admin' }), true);
  assert.equal(hasTeamFeatures({ roleId: 'staff' }), false);
  assert.equal(hasTeamFeatures(undefined), false);
});

test('get-started tasks start with the workspace done and always include the team step', () => {
  const data = { Properties: [{}], Clients: [], 'Follow-ups': [] };
  assert.deepEqual(
    deriveGettingStarted(data, { setupComplete: false }).map(({ id, complete }) => [id, complete]),
    [
      ['workspace', true],
      ['property', true],
      ['client', false],
      ['followUp', false],
      ['company', false],
      ['team', false],
    ],
  );
  assert.deepEqual(
    deriveGettingStarted(data, { setupComplete: true }).map(({ id }) => id),
    ['workspace', 'property', 'client', 'followUp', 'team'],
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

test('company drafts check every field and send office details tidied', () => {
  const company = { displayName: 'Old name', emirate: 'dubai', officePhone: '+97145552210' };
  const draft = companyDraft(company);
  assert.deepEqual(draft, {
    displayName: 'Old name',
    tradeLicence: '',
    emirate: 'dubai',
    officePhone: '+97145552210',
    officeAddress: '',
  });
  assert.equal(draftChanged(draft, company), false);
  assert.equal(draftChanged({ ...draft, tradeLicence: ' DED 1 ' }, company), true);
  assert.deepEqual(companyErrors(draft), {});
  assert.deepEqual(
    companyErrors({ ...draft, displayName: ' ', emirate: '', officePhone: '045552210' }),
    {
      displayName: 'company.invalidName',
      emirate: 'company.invalidEmirate',
      officePhone: 'company.invalidPhone',
    },
  );
  assert.deepEqual(
    companyErrors({ ...draft, officeAddress: 'a\nb', tradeLicence: 'L'.repeat(41) }),
    {
      tradeLicence: 'company.invalidLicence',
      officeAddress: 'company.invalidAddress',
    },
  );
  assert.deepEqual(
    companyPayload(4, { ...draft, displayName: ' New firm ', officePhone: '+971 4 (555) 2210' }),
    {
      version: 4,
      displayName: 'New firm',
      emirate: 'dubai',
      tradeLicence: null,
      officePhone: '+97145552210',
      officeAddress: null,
    },
  );
});
