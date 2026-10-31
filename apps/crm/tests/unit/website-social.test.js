import assert from 'node:assert/strict';
import test from 'node:test';
import * as social from '../../src/features/server/website/social/socialModel.js';

test('normalize trims, adds https:// when no scheme was typed and returns the canonical form', () => {
  assert.equal(
    social.normalize('instagram', '  instagram.com/synthetic  '),
    'https://instagram.com/synthetic',
  );
  assert.equal(social.normalize('instagram', 'INSTAGRAM.com/K'), 'https://instagram.com/K');
  assert.equal(
    social.normalize('website', 'synthetic-company.ae'),
    'https://synthetic-company.ae/',
  );
  assert.equal(social.normalize('x', 'https://x.com/synthetic'), 'https://x.com/synthetic');
  // A typed port is not mistaken for a scheme; a real scheme is kept for the check to refuse.
  assert.equal(social.normalize('instagram', 'instagram.com:443/k'), 'https://instagram.com/k');
  assert.equal(social.normalize('tiktok', 'http://tiktok.com/@k'), 'http://tiktok.com/@k');
  assert.equal(social.normalize('website', 'javascript:alert(1)'), 'javascript:alert(1)');
  assert.equal(social.normalize('instagram', '   '), '');
  assert.equal(social.normalize('instagram', 'https://exa mple'), 'https://exa mple');
});

test('each network accepts only its own hosts and profile subdomains', () => {
  for (const [field, link] of [
    ['instagram', 'https://instagram.com/synthetic'],
    ['instagram', 'https://www.instagram.com/synthetic'],
    ['facebook', 'https://m.facebook.com/synthetic'],
    ['facebook', 'https://fb.com/synthetic'],
    ['tiktok', 'https://vm.tiktok.com/abc'],
    ['linkedin', 'https://ae.linkedin.com/in/synthetic'],
    ['youtube', 'https://youtu.be/abc'],
    ['x', 'https://twitter.com/synthetic'],
    ['website', 'https://www.synthetic-company.ae/'],
  ])
    assert.equal(social.socialError(field, link), '', link);
  assert.equal(social.socialError('instagram', ''), '');
});

test('links elsewhere, unsafe or not canonical are refused with the field key', () => {
  for (const [field, link] of [
    ['instagram', 'https://instagram.com.evil.ae/x'],
    ['instagram', 'https://evil.instagram.com/x'],
    ['instagram', 'https://INSTAGRAM.com/k'],
    ['instagram', 'https://instagram.com'],
    ['instagram', 'https://user@instagram.com/k'],
    ['instagram', 'https://xn--nstagram-t2a.com/x'],
    ['facebook', 'https://instagram.com/k'],
    ['facebook', 'https://facebook.com/l.php?u=https%3A%2F%2Fevil.ae'],
    ['facebook', 'https://facebook.com/a?next=%2568ttps%253A%252F%252Fevil.ae'],
    ['tiktok', 'http://tiktok.com/@k'],
    ['linkedin', 'https://abc.linkedin.com/in/k'],
    ['youtube', 'https://youtube.com/redirect?q=k'],
    ['x', 'https://x.com:8443/k'],
    ['website', 'javascript:alert(1)'],
    ['website', 'https://127.0.0.1/'],
    ['website', 'https://localhost/'],
    ['website', 'https://synthetic.test/'],
    ['website', 'https://bit.ly/abc'],
    ['website', `https://synthetic.ae/${'a'.repeat(300)}`],
    ['myspace', 'https://myspace.com/k'],
  ])
    assert.equal(social.socialError(field, link), `${field}Invalid`, link);
});

test('form values come from saved links and go back without empty fields', () => {
  const values = social.fromSocial({ x: 'https://x.com/a', myspace: 'k', instagram: 5 });
  assert.deepEqual(Object.keys(values), social.SOCIAL_FIELDS);
  assert.equal(values.x, 'https://x.com/a');
  assert.equal(values.instagram, '');
  assert.equal(Object.hasOwn(values, 'myspace'), false);
  assert.deepEqual(social.fromSocial(null), social.fromSocial({}));
  assert.equal(social.toSocial(social.fromSocial(null)), undefined);
  assert.equal(social.toSocial(undefined), undefined);
  assert.deepEqual(social.toSocial({ ...values, instagram: ' instagram.com/a ', website: '' }), {
    instagram: 'https://instagram.com/a',
    x: 'https://x.com/a',
  });
});

test('socialErrors checks each typed link as it will be sent', () => {
  assert.deepEqual(social.socialErrors(undefined), {});
  assert.deepEqual(
    social.socialErrors({ instagram: 'instagram.com/a', website: 'synthetic-company.ae' }),
    {},
  );
  assert.deepEqual(
    social.socialErrors({ instagram: 'https://instagram.com.evil.ae/x', x: 'facebook.com/k' }),
    { instagram: 'instagramInvalid', x: 'xInvalid' },
  );
});
