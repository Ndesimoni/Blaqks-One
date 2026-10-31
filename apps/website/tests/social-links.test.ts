// Mirrors services/crm-api/src/sites/social_tests.rs: the website applies the same link rules
// as the CRM API (docs/website-social-links.md §3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { publicSocial, socialLink, websiteHost, withoutWebsite } from '../src/lib/social-links.ts';

test('networks accept only their own profile hosts', () => {
  for (const [field, good] of [
    ['instagram', 'https://instagram.com/keyswithsimoni'],
    ['instagram', 'https://www.instagram.com/keys'],
    ['youtube', 'https://youtu.be/abc'],
    ['x', 'https://twitter.com/keys'],
    ['tiktok', 'https://vm.tiktok.com/abc'],
    ['linkedin', 'https://ae.linkedin.com/in/keys'],
  ])
    assert.ok(socialLink(field, good), good);
  for (const bad of [
    'http://instagram.com/keys',
    'https://instagram.com.evil.example/keys',
    'https://evilinstagram.com/keys',
    'https://l.instagram.com/keys',
    'https://user@instagram.com/keys',
    'https://instagram.com:8443/keys',
    'https://instagram.com./keys',
    'https://INSTAGRAM.com/keys',
    'https://instagram.com',
    'javascript:alert(1)',
    ' https://instagram.com/keys',
    'https://instagram.com/a b',
    'https://instagram.com\\@evil.example/',
  ])
    assert.ok(!socialLink('instagram', bad), bad);
  assert.ok(!socialLink('facebook', 'https://instagram.com/keys'));
  assert.ok(!socialLink('unknown', 'https://instagram.com/keys'));
  assert.ok(!socialLink('instagram', `https://instagram.com/${'k'.repeat(300)}`));
});

test('redirect pages and wrapped addresses are refused', () => {
  for (const [field, bad] of [
    ['facebook', 'https://facebook.com/l.php?u=https%3A%2F%2Fevil.example'],
    ['facebook', 'https://l.facebook.com/l.php?u=x'],
    ['youtube', 'https://youtube.com/redirect?q=https://evil.example'],
    ['linkedin', 'https://linkedin.com/redir/redirect?url=x'],
    ['x', 'https://x.com/i/redirect?url=x'],
    ['instagram', 'https://instagram.com/k?next=https%253A%252F%252Fevil.example'],
    ['instagram', 'https://instagram.com/k?next=%2F%2Fevil.example'],
  ])
    assert.ok(!socialLink(field, bad), bad);
  assert.ok(socialLink('youtube', 'https://www.youtube.com/watch?v=abc'));
});

test('the other website is a real domain, never an address, shortener or lookalike', () => {
  assert.ok(socialLink('website', 'https://keyswithsimoni.ae/about'));
  for (const bad of [
    'https://127.0.0.1/',
    'https://[::1]/',
    'https://localhost/',
    'https://intranet/',
    'https://xn--nstagram-6xa.com/',
    'https://bit.ly/abc',
    'https://company.example/',
    'https://shop.internal/',
  ])
    assert.ok(!socialLink('website', bad), bad);
  assert.equal(websiteHost('https://keyswithsimoni.ae/about'), 'keyswithsimoni.ae');
  assert.equal(websiteHost('https://www.example.com/harbour'), 'example.com');
});

test('a social object keeps known fields with valid links and never throws', () => {
  assert.deepEqual(publicSocial({ instagram: 'https://instagram.com/k' }), {
    instagram: 'https://instagram.com/k',
  });
  for (const value of [
    {},
    { instagram: '' },
    { myspace: 'https://myspace.com/k' },
    ['https://instagram.com/k'],
    { instagram: { url: 'https://instagram.com/k' } },
    'https://instagram.com/k',
    null,
    undefined,
    42,
  ])
    assert.equal(publicSocial(value), undefined, JSON.stringify(value));
});

test('serving drops invalid links one at a time and member websites on the general site', () => {
  const stored = {
    instagram: 'https://instagram.com/k',
    website: 'https://keyswithsimoni.ae/',
    tiktok: 'https://bit.ly/old',
  };
  const company = publicSocial(stored);
  assert.deepEqual(Object.keys(company ?? {}), ['instagram', 'website']);
  assert.deepEqual(withoutWebsite(company), { instagram: 'https://instagram.com/k' });
  assert.equal(withoutWebsite({ website: 'https://keyswithsimoni.ae/' }), undefined);
  assert.equal(publicSocial({ tiktok: 'nope' }), undefined);
});
