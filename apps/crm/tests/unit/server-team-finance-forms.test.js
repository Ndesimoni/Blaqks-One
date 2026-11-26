import test from 'node:test';
import assert from 'node:assert/strict';
import {
  companyShareText,
  settingsBody,
  settingsDirty,
  settingsDraft,
  settingsErrors,
  settingsMessages,
} from '../../src/features/server-team/financeSettingsForm.js';

const saved = {
  version: 4,
  agentShareBp: 5050,
  secondAgentSource: 'company',
  maxReferralShareBp: 2000,
  vatRegistered: true,
  vatRateBp: 500,
  trn: '100123456700003',
};

test('settings drafts round-trip basis points as exact percentage text', () => {
  const draft = settingsDraft(saved);
  assert.deepEqual(draft, {
    agentShare: '50.5',
    secondAgentSource: 'company',
    maxReferralShare: '20',
    vatRegistered: true,
    trn: '100123456700003',
  });
  assert.deepEqual(settingsBody(draft, saved), {
    version: 4,
    agentShareBp: 5050,
    secondAgentSource: 'company',
    maxReferralShareBp: 2000,
    vatRegistered: true,
    trn: '100123456700003',
  });
  assert.equal(settingsDirty(draft, saved), false);
  assert.equal(settingsDirty({ ...draft, agentShare: '51' }, saved), true);
  assert.equal(companyShareText('60.25'), 'The company keeps 39.75%.');
  assert.equal(companyShareText('abc'), '');
});

test('first-time settings send a null version and blank TRN as null', () => {
  const draft = { ...settingsDraft(null), agentShare: '60' };
  assert.equal(settingsDraft(null).maxReferralShare, '0');
  assert.deepEqual(settingsBody({ ...draft, trn: '  ' }, null), {
    version: null,
    agentShareBp: 6000,
    secondAgentSource: 'first_agent',
    maxReferralShareBp: 0,
    vatRegistered: false,
    trn: null,
  });
});

test('settings validation refuses floats beyond 2 dp, out-of-range shares and bad TRNs', () => {
  const draft = settingsDraft(saved);
  assert.deepEqual(settingsErrors(draft), {});
  const percent = 'Percentages must be between 0 and 100 with up to two decimals.';
  assert.equal(settingsErrors({ ...draft, agentShare: '12.345' }).agentShare, percent);
  assert.equal(settingsErrors({ ...draft, agentShare: '100.01' }).agentShare, percent);
  assert.equal(
    settingsErrors({ ...draft, agentShare: '' }).agentShare,
    settingsMessages.agentShare,
  );
  assert.equal(settingsErrors({ ...draft, maxReferralShare: '-1' }).maxReferralShare, percent);
  assert.equal(settingsErrors({ ...draft, trn: '12345' }).trn, 'Enter a 15-digit TRN.');
  assert.equal(
    settingsErrors({ ...draft, secondAgentSource: 'x' }).secondAgentSource,
    settingsMessages.secondAgentSource,
  );
  assert.deepEqual(settingsErrors({ ...draft, trn: '' }), {});
});
