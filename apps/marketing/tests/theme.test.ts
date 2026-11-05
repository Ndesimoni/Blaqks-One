import assert from 'node:assert/strict';
import test from 'node:test';
import { readTheme, themeCookie } from '../src/lib/theme.ts';

test('the shared theme is read from the b1-theme cookie only', () => {
  assert.equal(readTheme('a=1; b1-theme=light; c=2'), 'light');
  assert.equal(readTheme('b1-theme=dark'), 'dark');
  assert.equal(readTheme('xb1-theme=light'), null);
  assert.equal(readTheme('b1-theme=blue'), null);
  assert.equal(readTheme(''), null);
});

test('the cookie lasts a year and spans the parent domain when one is set', () => {
  assert.equal(themeCookie('light', ''), 'b1-theme=light; Path=/; Max-Age=31536000; SameSite=Lax');
  assert.match(themeCookie('dark', '.blaqksone.com'), /; Domain=\.blaqksone\.com$/);
});
