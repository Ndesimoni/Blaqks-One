import test from 'node:test';
import assert from 'node:assert/strict';
import {
  eligibleProfiles,
  initialMedia,
  makeCover,
  publishBody,
  publishError,
  toggle,
} from '../../src/features/server/website/publish/publishModel.js';
import { id, photo, ready } from './website-publish-fixtures.js';

test('media starts with every stored photo up to 20 and image floor plans only', () => {
  const photos = Array.from({ length: 23 }, (_, n) => photo(n + 1));
  const plans = [
    { name: 'plan.pdf', file: id(90), type: 'application/pdf' },
    { name: 'plan.jpg', file: id(91), type: 'image/jpeg' },
    { name: 'draft.jpg', src: 'blob:unsaved', type: 'image/jpeg' },
  ];
  const media = initialMedia({ media_photos: photos, media_floorplans: plans });
  assert.equal(media.photos.length, 20);
  assert.equal(media.photos[0], id(1));
  assert.deepEqual(media.floorPlans, [id(91)]);
});

test('toggling respects the limit and the cover moves first', () => {
  const full = Array.from({ length: 20 }, (_, n) => id(n + 1));
  assert.equal(toggle(full, id(99), 20), full);
  assert.deepEqual(toggle(full, id(3), 20).length, 19);
  assert.deepEqual(toggle([id(1)], id(2), 20), [id(1), id(2)]);
  assert.deepEqual(makeCover([id(1), id(2), id(3)], id(3)), [id(3), id(1), id(2)]);
});

test('eligible representatives are consented, active and allowed; the Admin always is', () => {
  const admin = { id: 'pa', member: 'admin', consent: true, active: true, canPublish: false };
  const staff = { id: 'ps', member: 'staff', consent: true, active: true, canPublish: true };
  const blocked = { id: 'pb', member: 'b', consent: true, active: true, canPublish: false };
  const hidden = { ...staff, id: 'ph', active: false };
  const unconsented = { ...staff, id: 'pu', consent: false };
  const profiles = [admin, staff, blocked, hidden, unconsented];
  assert.deepEqual(
    eligibleProfiles(profiles, 'admin').map((p) => p.id),
    ['pa', 'ps'],
  );
  assert.deepEqual(
    eligibleProfiles(profiles, null).map((p) => p.id),
    ['ps'],
  );
});

test('the body carries choices only: version 0 first, the existing version to republish', () => {
  const entry = { id: id(70), version: 4, record: ready };
  const draft = {
    agentProfileId: id(80),
    destination: 'general_and_company',
    permit: '  SYN-PERMIT-1 ',
    market: 'resale',
    photos: Array.from({ length: 22 }, (_, n) => id(n + 1)),
    floorPlans: [id(91), id(92), id(93), id(94)],
  };
  const first = publishBody({ entry, draft, existing: null });
  assert.equal(first.version, 0);
  assert.equal(first.recordVersion, 4);
  assert.equal(first.permitReference, 'SYN-PERMIT-1');
  assert.equal(first.market, 'resale');
  assert.equal(first.photos.length, 20);
  assert.equal(first.floorPlans.length, 3);
  assert.equal('developer' in first, false);
  for (const secret of ['PRIVATE-NOTES', 'SYNTHETIC-UNIT-1', 'SYNTHETIC-TOWER'])
    assert.equal(JSON.stringify(first).includes(secret), false);
  assert.equal(publishBody({ entry, draft, existing: { version: 3 } }).version, 3);
  const rent = { ...entry, record: { ...ready, sale_rental: 'Rental' } };
  assert.equal('market' in publishBody({ entry: rent, draft, existing: null }), false);
  assert.equal('market' in publishBody({ entry, draft: { ...draft, market: '' } }), false);
});

test('refusals map to plain English; anything else keeps the server message', () => {
  const error = (status, message, code) => ({ status, message, details: { code } });
  const stale = publishError(error(409, 'The property has changed.', 'version_conflict'));
  assert.deepEqual(stale, { key: 'errorStale', stale: true });
  assert.deepEqual(
    publishError(error(409, 'This property has reached its public listing limit.', 'conflict')),
    {
      key: 'errorCapacity',
    },
  );
  assert.deepEqual(publishError(error(404, 'Record not found.', 'not_found')), {
    key: 'errorHidden',
  });
  assert.deepEqual(
    publishError(
      error(403, 'Company listing eligibility must be verified before publication.', 'forbidden'),
    ),
    { key: 'errorLicence' },
  );
  assert.deepEqual(
    publishError(error(400, 'Choose a supported property type before publishing.')),
    {
      message: 'Choose a supported property type before publishing.',
    },
  );
  assert.deepEqual(publishError({ status: 500 }), { key: 'errorGeneric' });
});
