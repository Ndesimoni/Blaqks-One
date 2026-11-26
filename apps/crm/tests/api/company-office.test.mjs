import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { companyBody, newCompany, putCompany, readCompany, snapshot } from './company-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

const office = {
  tradeLicence: '  DED 1043378 ',
  officePhone: '+971 4 555 2210',
  officeAddress: 'Office 1204, Synthetic Plaza, Dubai Marina',
};

test('office details save tidied, survive a sign-up style save and clear when emptied', async () => {
  const { admin } = await newCompany('office');
  const saved = await putCompany(admin, companyBody(office));
  assert.equal(saved.status, 200, JSON.stringify(saved.value));
  const expected = {
    tradeLicence: 'DED 1043378',
    officePhone: '+97145552210',
    officeAddress: office.officeAddress,
  };
  assert.deepEqual(
    {
      tradeLicence: saved.value.tradeLicence,
      officePhone: saved.value.officePhone,
      officeAddress: saved.value.officeAddress,
    },
    expected,
  );
  // Sign-up's setup sends only the name and emirate: the office details are kept.
  const renamed = await putCompany(admin, companyBody({ version: 2, displayName: 'Renamed' }));
  assert.equal(renamed.status, 200);
  assert.equal(renamed.value.displayName, 'Renamed');
  assert.equal(renamed.value.tradeLicence, expected.tradeLicence);
  assert.equal(renamed.value.officePhone, expected.officePhone);
  // Empty text or null clears a detail.
  const cleared = await putCompany(
    admin,
    companyBody({ version: 3, tradeLicence: ' ', officePhone: null, officeAddress: '' }),
  );
  assert.equal(cleared.status, 200);
  const read = await readCompany(admin);
  assert.equal(read.tradeLicence, null);
  assert.equal(read.officePhone, null);
  assert.equal(read.officeAddress, null);
  assert.equal(read.version, 4);
});

test('invalid office details are refused without changing the company', async () => {
  const { admin } = await newCompany('office-invalid');
  const before = snapshot(admin.user.workspaceId);
  for (const change of [
    { tradeLicence: 'L'.repeat(41) },
    { tradeLicence: 12 },
    { officePhone: '045552210' },
    { officePhone: '+971 4 555 2210 ext 3' },
    { officeAddress: 'A'.repeat(201) },
    { officeAddress: 'Line one\nline two' },
  ]) {
    const response = await putCompany(admin, companyBody(change));
    assert.equal(response.status, 400, JSON.stringify(change));
    assert.equal(response.value.code, 'invalid_company');
  }
  assert.equal(snapshot(admin.user.workspaceId), before);
});
