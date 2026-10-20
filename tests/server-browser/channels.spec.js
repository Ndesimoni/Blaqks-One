import { test, expect } from './fixtures.js';
import { signIn, session } from './helpers.js';
import { noPageOverflow, setTheme } from './assign-helpers.js';
import { query } from '../api/helpers.mjs';

const card = (page, name) => page.getByRole('article', { name, exact: true });

test.beforeEach(async ({ page }) => {
  await signIn(page);
  const identity = await session(page);
  const workspace = identity.user.workspaceId;
  // Events are insert-only history, so start each test by disconnecting live rows.
  query(`UPDATE integrations.crm_channel_connections
     SET state='disconnected',credential_sealed=NULL,credential_key_version=NULL,
         credential_updated_at=NULL,version=version+1
     WHERE workspace_id='${workspace}' AND state<>'disconnected'`);
});

test('an Admin connects, reconnects and disconnects a channel', async ({ page }) => {
  await page.goto('/#/channels');
  await expect(page.locator('.page-heading h1')).toHaveText('Channels');
  await expect(page.getByRole('article')).toHaveCount(5);
  const whatsapp = card(page, 'WhatsApp');
  await whatsapp.getByRole('button', { name: 'Connect', exact: true }).click();
  const form = page.getByRole('form', { name: 'Connect WhatsApp' });
  await form.getByLabel('Display label').fill('Studio line');
  await form.getByLabel('Account ID or address').fill('+971500000777');
  await form.getByLabel('Credential or access token').fill('synthetic-browser-secret');
  await form.getByRole('button', { name: 'Connect account' }).click();
  await expect(page.getByText('Studio line is connected.')).toBeVisible();
  await expect(whatsapp.getByText('Connected', { exact: true })).toBeVisible();
  await expect(whatsapp).toContainText('Account ending 0777');
  await expect(whatsapp).not.toContainText('synthetic-browser-secret');
  await page.reload();
  await expect(card(page, 'WhatsApp')).toContainText('Studio line');

  await card(page, 'WhatsApp').getByRole('button', { name: 'Reconnect', exact: true }).click();
  const renew = page.getByRole('form', { name: 'Reconnect WhatsApp' });
  await renew.getByLabel('Credential or access token').fill('another-synthetic-secret');
  await renew.getByRole('button', { name: 'Save credential' }).click();
  await expect(page.getByText('Studio line is reconnected.')).toBeVisible();

  const active = card(page, 'WhatsApp');
  await active.getByRole('button', { name: 'Disconnect', exact: true }).click();
  const confirm = page.getByRole('group', { name: 'Disconnect channel' });
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(active.getByText('Connected', { exact: true })).toBeVisible();
  await active.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await confirm.getByRole('button', { name: 'Disconnect channel', exact: true }).click();
  await expect(page.getByText('Studio line is disconnected.')).toBeVisible();
  await expect(active).toContainText('Not connected yet.');
  await expect(active).not.toContainText('Studio line');
  await expect(active.getByRole('button', { name: 'Reconnect', exact: true })).toHaveCount(0);
  await expect(active.getByRole('button', { name: 'Connect', exact: true })).toHaveCount(1);
});

test('channels remain usable at 390px and 1280px in both themes', async ({ page }, testInfo) => {
  const identity = await session(page);
  const workspace = identity.user.workspaceId;
  const created = await page.request.post(`/api/crm/workspaces/${workspace}/channels`, {
    headers: { Origin: 'http://localhost:5175', 'X-CSRF-Token': identity.csrfToken },
    data: {
      connection: {
        channel: 'whatsapp',
        provider: 'twilio',
        label: 'Responsive line',
        externalAccountId: '+971500000888',
        credential: 'synthetic-responsive-secret',
      },
    },
  });
  expect(created.status()).toBe(201);
  const id = (await created.json()).connection.id;
  query(
    `UPDATE integrations.crm_channel_connections SET state='reconnect_required' WHERE id='${id}'`,
  );
  await page.goto('/#/channels');
  await expect(page.locator('.channels-banner')).toContainText('need reconnecting');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['dark', 'light']) {
      await setTheme(page, theme);
      await expect(card(page, 'WhatsApp')).toContainText('Responsive line');
      await expect(card(page, 'Email')).toBeVisible();
      await noPageOverflow(page);
      await page.screenshot({ path: testInfo.outputPath(`channels-${width}-${theme}.png`) });
    }
  }
});

test('Team activity lists redacted channel events for the Admin', async ({ page }, testInfo) => {
  const identity = await session(page);
  const base = `/api/crm/workspaces/${identity.user.workspaceId}/channels`;
  const headers = { Origin: 'http://localhost:5175', 'X-CSRF-Token': identity.csrfToken };
  const connection = {
    channel: 'tiktok',
    provider: 'tiktok',
    label: 'Feed studio TikTok',
    externalAccountId: 'tt-feed-synthetic-0909',
    credential: 'synthetic-feed-secret',
  };
  const created = await page.request.post(base, { headers, data: { connection } });
  expect(created.status()).toBe(201);
  const id = (await created.json()).connection.id;
  const removed = await page.request.delete(`${base}/${id}`, {
    headers,
    data: { expectedVersion: 1 },
  });
  expect(removed.status()).toBe(200);
  await page.goto('/#/team-activity');
  await page.getByLabel('Type').selectOption({ label: 'Channel changes' });
  const feed = page.getByRole('region', { name: 'Activity', exact: true });
  await expect(feed).toContainText('You connected TikTok');
  await expect(feed).toContainText('You disconnected TikTok');
  await expect(feed).not.toContainText('Feed studio TikTok');
  await expect(feed).not.toContainText('0909');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['dark', 'light']) {
      await setTheme(page, theme);
      await expect(feed.locator('.activity-row').first()).toBeVisible();
      await noPageOverflow(page);
      await page.screenshot({ path: testInfo.outputPath(`activity-${width}-${theme}.png`) });
    }
  }
});
