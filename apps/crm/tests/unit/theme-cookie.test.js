import test from 'node:test';
import assert from 'node:assert/strict';
import { readThemeCookie, writeThemeCookie } from '../../src/lib/themeCookie.js';

test('the CRM reads the theme the website shares, and nothing else', () => {
  assert.equal(readThemeCookie({ cookie: 'x=1; b1-theme=light' }), 'light');
  assert.equal(readThemeCookie({ cookie: 'b1-theme=sepia' }), null);
  assert.equal(readThemeCookie(undefined), null);
});

test('the CRM shares its theme for a year, across the parent domain when set', () => {
  const doc = { cookie: '' };
  writeThemeCookie('dark', doc, {});
  assert.equal(doc.cookie, 'b1-theme=dark; Path=/; Max-Age=31536000; SameSite=Lax');
  writeThemeCookie('light', doc, { VITE_THEME_COOKIE_DOMAIN: '.blaqksone.com' });
  assert.match(doc.cookie, /^b1-theme=light;.*; Domain=\.blaqksone\.com$/);
  writeThemeCookie('blue', doc, {});
  assert.match(doc.cookie, /^b1-theme=light/);
});
