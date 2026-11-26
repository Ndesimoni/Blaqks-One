import assert from 'node:assert/strict';
import test from 'node:test';
import { intakeBody, intakeUrl, internationalPhone } from '../src/lib/crm-intake.ts';

test('contact messages become Blaqks One clients through the CRM intake (BO1e)', () => {
  assert.equal(internationalPhone('+971 50 123 4567'), '+971501234567');
  assert.equal(internationalPhone('(050) 123-4567'), '');
  const body = intakeBody(
    {
      name: 'Synthetic Broker',
      company: 'Synthetic Homes',
      email: 'broker@example.test',
      mobile: '+971 50 123 4567',
      teamSize: '4–15 people',
      message: 'We would like a demo.',
    },
    '',
  );
  assert.equal(body.phone, '+971501234567');
  assert.equal(body.message, 'Team size: 4–15 people\n\nWe would like a demo.');
  assert.equal(body.website, '');
  delete process.env.BLAQKS_ONE_API_ORIGIN;
  assert.equal(intakeUrl(), null);
  process.env.BLAQKS_ONE_API_ORIGIN = 'http://127.0.0.1:8788';
  assert.equal(intakeUrl()?.href, 'http://127.0.0.1:8788/api/public/blaqks-one/contact');
  process.env.BLAQKS_ONE_API_ORIGIN = 'http://crm.example.test';
  assert.throws(() => intakeUrl(), /HTTPS/);
});
