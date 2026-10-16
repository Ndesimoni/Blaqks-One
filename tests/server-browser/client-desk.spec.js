import { test, expect } from './fixtures.js';
import { memberPage } from './assign-helpers.js';
import { actions, setGrants } from './permissions-fixtures.js';
import { assignTeam, dashboardTeam, held } from './dashboard-fixtures.js';

test('the Client desk shows a connected profile, property matches and timeline', async ({
  browser,
}) => {
  const { team, one, mine } = await dashboardTeam('deskstaff');
  await setGrants(team, 'one', { channelAccess: { whatsapp: true, email: false } });
  const { page, context } = await memberPage(browser, one.email);
  try {
    await page.goto('/#/client-desk');
    await expect(page.locator('.page-heading h1')).toHaveText('Client search & matching');
    await expect(page.getByRole('region', { name: 'Client desk connection status' })).toHaveCount(
      0,
    );
    await expect(page.locator('.desk-list-title')).toContainText('1 contact');
    const profile = page.locator('.profile-hero');
    await expect(profile).toContainText(`CLIENT PROFILE · ${mine.record.client_id}`);
    await expect(profile.getByRole('heading', { name: 'Dash client one' })).toBeVisible();
    await expect(profile.getByRole('button', { name: 'Edit profile' })).toBeVisible();
    const matches = page.locator('.panel').filter({ hasText: 'Curated property matches' });
    await expect(matches).toContainText('1 match');
    await expect(matches).toContainText('Dash Marina listing');
    await expect(matches.getByRole('button', { name: 'Shortlist' })).toBeVisible();
    const timeline = page.locator('.panel').filter({ hasText: 'Relationship timeline' });
    await expect(timeline).toContainText('Call Dash client one');
    await expect(timeline).toContainText('Dash Marina listing');
    for (const secret of ['Dash hidden client', 'Dash hidden listing', 'Call Dash hidden client'])
      await expect(page.getByText(secret)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Preview client email' })).toBeDisabled();
    await expect(page.locator('.client-message-tools')).toContainText(
      'WhatsApp: Allowed · Email: Not allowed. Previews do not send messages.',
    );
    await page.getByRole('button', { name: 'Start message', exact: true }).click();
    await expect(page.locator('.toast')).toContainText('Messaging accounts are not connected');
    await page.getByRole('button', { name: 'Preview WhatsApp message' }).click();
    const preview = page.getByRole('dialog', { name: 'Client WhatsApp preview' });
    await expect(preview).toContainText('No message will be sent');
    await preview.getByRole('button', { name: /close/i }).first().click();
    await expect(preview).toHaveCount(0);
    await page.getByLabel('Search clients in client desk').fill('nobody');
    await expect(page.getByText('No matching clients')).toBeVisible();
  } finally {
    await context.close();
  }
});

test('view-only members get no add, edit or shortlist actions on the Dashboard or Client desk', async ({
  browser,
}) => {
  const { team, one } = await dashboardTeam('deskview');
  await setGrants(team, 'one', { actions: actions(false) });
  const { page, context } = await memberPage(browser, one.email);
  try {
    await page.goto('/#/dashboard');
    await expect(page.getByRole('region', { name: 'Records in view' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View follow-ups' })).toBeVisible();
    for (const name of ['Add new lead', 'Create follow-up'])
      await expect(page.getByRole('button', { name })).toHaveCount(0);
    await page.goto('/#/client-desk');
    await expect(page.locator('.profile-hero')).toContainText('Dash client one');
    const desk = page.locator('.desk-layout');
    for (const name of ['Add client', 'Edit profile', 'Shortlist'])
      await expect(desk.getByRole('button', { name })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('a client reached only through an assigned follow-up shows name, phone and email only', async ({
  browser,
}) => {
  const team = await assignTeam('desktask');
  const { one } = team.people;
  const client = await held(team, 'Clients', {
    full_name: 'Desk task client',
    phone: '+971500000088',
    email: 'desk-task@client.test',
    preferred_communities: 'Private desk community',
    notes: 'Private desk notes',
    maximum_budget_aed: '9100000',
  });
  await held(
    team,
    'Follow-ups',
    { client_id: client.record.client_id, next_action: 'Desk call' },
    one.id,
  );
  const { page, context } = await memberPage(browser, one.email);
  try {
    await page.goto('/#/client-desk');
    await expect(page.locator('.desk-list-title')).toContainText('0 contacts');
    await expect(page.locator('.profile-hero')).toHaveCount(0);
    const card = page.getByRole('region', { name: 'Clients on your follow-ups' });
    await expect(card).toContainText('Desk task client');
    await expect(card).toContainText(client.record.client_id);
    await expect(card.getByRole('link', { name: '+971500000088' })).toHaveAttribute(
      'href',
      'tel:+971500000088',
    );
    await expect(card.getByRole('link', { name: 'desk-task@client.test' })).toBeVisible();
    for (const secret of ['Private desk community', 'Private desk notes', '9,100,000', 'Edit'])
      await expect(page.locator('.desk-layout')).not.toContainText(secret);
    await expect(page.getByText('Curated property matches')).toHaveCount(0);
    await page.goto('/#/dashboard');
    const priorities = page.locator('.activity-panel').filter({ hasText: 'Your priorities' });
    await expect(priorities).toContainText(
      `${client.record.client_id} · Desk task client (not assigned to you)`,
    );
  } finally {
    await context.close();
  }
});
