import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readMarketplaceStatus } from '../../src/features/server/marketplace/marketplaceModel.js';
import {
  readMember,
  readOwnProfile,
  readProfile,
  readTerms,
} from '../../src/features/server/marketplace/marketplaceProfileModel.js';

/** Strict readers for the marketplace answers (packets MK1a and MK1b). */
const checklist = {
  ageDays: 8,
  properties: 5,
  clients: 5,
  contacts: 3,
  followUps: 3,
  viewings: 1,
  recent: true,
  met: true,
};

const statusPayload = () => ({
  company: {
    state: 'approved',
    enabled: true,
    version: 2,
    canApplyFrom: null,
    declineReason: '',
    checklist,
  },
  member: {
    joined: true,
    profile: {
      emirates: ['dubai'],
      communities: ['Dubai Marina'],
      propertyTypes: ['residential_sale'],
      experienceYears: 4,
      licence: { number: '12345', authority: 'RERA' },
      joinedAt: '2026-10-24T10:00:00.000Z',
      hasPhoto: true,
      version: 3,
    },
    termsCurrent: true,
    termsVersion: '2026-10-24.1',
    termsDigest: 'a'.repeat(64),
  },
});

test('a company status is read strictly, with or without the member block', () => {
  const read = readMarketplaceStatus(statusPayload());
  assert.equal(read.company.state, 'approved');
  assert.equal(read.company.version, 2);
  assert.equal(read.company.checklist.met, true);
  assert.equal(read.member.joined, true);
  assert.equal(read.member.profile.version, 3);
  assert.deepEqual(read.member.profile.communities, ['Dubai Marina']);
  const noMember = readMarketplaceStatus({ company: statusPayload().company, member: null });
  assert.equal(noMember.member, null);
  assert.throws(() =>
    readMarketplaceStatus({
      ...statusPayload(),
      company: { ...statusPayload().company, state: 'maybe' },
    }),
  );
  assert.throws(() => readMarketplaceStatus({ company: {} }));
  assert.throws(() => readMarketplaceStatus(null));
});

test('the terms need exactly four commitments and a digest', () => {
  const terms = {
    version: '2026-10-24.1',
    body: 'Draft body.',
    consent: 'Shown to members.',
    commitments: ['One.', 'Two.', 'Three.', 'Four.'],
    digest: 'b'.repeat(64),
    draft: true,
  };
  assert.equal(readTerms({ terms }).commitments.length, 4);
  assert.equal(readTerms({ terms }).draft, true);
  assert.throws(() => readTerms({ terms: { ...terms, commitments: ['One.'] } }));
  assert.throws(() => readTerms({ terms: { ...terms, version: 1 } }));
  assert.throws(() => readTerms({}));
});

test('another member profile keeps its facts and never invents a contact', () => {
  const profile = {
    memberId: '00000000-0000-4000-8000-000000000001',
    name: 'Synthetic Broker',
    company: 'Synthetic Company',
    emirates: ['dubai', 'sharjah'],
    communities: [],
    propertyTypes: ['commercial_rent'],
    experienceYears: 0,
    licence: null,
    joinedAt: '2026-10-24T10:00:00.000Z',
    hasPhoto: false,
    declared: true,
  };
  const read = readProfile({ profile });
  assert.equal(read.declared, true);
  assert.equal(read.licence, null);
  assert.deepEqual(read.emirates, ['dubai', 'sharjah']);
  assert.throws(() => readProfile({ profile: { ...profile, licence: { number: 'X' } } }));
  assert.throws(() => readProfile({ profile: { ...profile, experienceYears: -1 } }));
  assert.throws(() => readProfile({ profile: { ...profile, communities: 'Dubai Marina' } }));
});

test('the member block and the own profile are read strictly', () => {
  const member = readMember(statusPayload().member);
  assert.equal(member.termsCurrent, true);
  assert.equal(member.termsDigest.length, 64);
  const own = readOwnProfile(statusPayload().member.profile);
  assert.equal(own.hasPhoto, true);
  assert.equal(own.licence.authority, 'RERA');
  assert.throws(() => readMember({ joined: 'yes' }));
  assert.throws(() =>
    readMember({ joined: true, profile: null, termsCurrent: true, termsVersion: 1 }),
  );
});
