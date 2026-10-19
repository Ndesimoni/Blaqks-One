import assert from 'node:assert/strict';
import test from 'node:test';
import {
  companyPayload,
  detailsError,
  errorKey,
  setupError,
  startPayload,
  validCode,
} from '../../src/features/signup/signupModel.js';

const valid = {
  name: '  Noor Agent  ',
  email: '  NOOR@EXAMPLE.TEST ',
  phone: '+971 50 123 4567',
  password: 'Secure9!Agent',
  consent: true,
};
const status = { terms: { version: 'terms-1' }, privacy: { version: 'privacy-1' } };

test('sign-up details use the server validation order', () => {
  assert.deepEqual(detailsError({ ...valid, name: '' }), ['name', 'signupErrors.invalidName']);
  assert.deepEqual(detailsError({ ...valid, email: 'not-an-email' }), [
    'email',
    'signupErrors.invalidEmail',
  ]);
  assert.deepEqual(detailsError({ ...valid, phone: '0501234567' }), [
    'phone',
    'signupErrors.invalidPhone',
  ]);
  assert.deepEqual(detailsError({ ...valid, password: 'weak' }), [
    'password',
    'signupErrors.weakPassword',
  ]);
  assert.deepEqual(detailsError({ ...valid, consent: false }), [
    'consent',
    'signupErrors.consentRequired',
  ]);
  assert.equal(detailsError(valid), null);
});

test('start payload normalises identity and contains only the public contract', () => {
  assert.deepEqual(startPayload(valid, status, 'ar'), {
    name: 'Noor Agent',
    email: 'noor@example.test',
    phone: '+971501234567',
    password: 'Secure9!Agent',
    termsVersion: 'terms-1',
    privacyVersion: 'privacy-1',
    language: 'ar',
    botToken: 'local-development',
  });
});

test('verification, setup and server errors map to bounded UI states', () => {
  assert.equal(validCode('012345'), true);
  assert.equal(validCode('12345'), false);
  assert.equal(validCode('12345a'), false);

  assert.deepEqual(setupError({ displayName: 'Noor', emirate: '' }), [
    'emirate',
    'signupErrors.invalidCompany',
  ]);

  assert.deepEqual(companyPayload({ version: 2 }, { displayName: ' Noor ', emirate: '' }), {
    version: 2,
    displayName: 'Noor',
    emirate: '',
  });
  assert.equal(errorKey({ details: { code: 'code_locked' } }), 'signupErrors.codeLocked');
  assert.equal(
    errorKey({ details: { code: 'private_server_detail' } }),
    'signupErrors.unavailable',
  );
});
