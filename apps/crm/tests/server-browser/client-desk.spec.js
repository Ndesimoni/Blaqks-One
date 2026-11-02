import { test, expect } from './fixtures.js';
import { memberPage } from './assign-helpers.js';
import { actions, setGrants } from './permissions-fixtures.js';
import { assignTeam, dashboardTeam, held } from './dashboard-fixtures.js';

test('the Client desk shows the chosen client, their contact actions, matches and activity', async ({
  browser,
}) => {
  const { team, one, mine } = await dashboardTeam('deskstaff');
  await setGrants(team, 'one', { channelAccess: { whatsapp: true, email: false } });
  const { page, context } = await memberPage(browser, one.email);
  try {
    await page.goto('/#/client-desk');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Clients');
    await expect(page.getByRole('region', { name: 'Client desk connection status' })).toHaveCount(
      0,
    );
    await expect(page.locator('.client-desk-row').first()).toHaveAttribute('aria-current', 'true');
    const hero = page.locator('.client-desk-hero');
    await expect(hero.getByRole('heading', { name: 'Dash client one' })).toBeVisible();
    // The mockup's Call and WhatsApp follow the number and the WhatsApp grant; no email grant.
    await expect(hero.getByRole('link', { name: 'Call Dash client one' })).toHaveAttribute(
      'href',
      'tel:+971500000101',
    );
    await expect(hero.getByRole('link', { name: 'WhatsApp Dash client one' })).toBeVisible();
    await expect(hero.getByRole('button', { name: 'Email Dash client one' })).toHaveCount(0);
    const matches = page.getByRole('region', { name: /^1 matching property/ });
    await expect(matches).toContainText('Dash Marina listing');
    await expect(matches.getByRole('button', { name: 'Add to shortlist' })).toBeVisible();
    await expect(matches.getByRole('link', { name: 'Send on WhatsApp' })).toHaveAttribute(
      'href',
      /^https:\/\/wa\.me\/971500000101\?text=Dash%20Marina%20listing/,
    );
    const activity = page.getByRole('region', { name: 'Activity', exact: true });
    await expect(activity).toContainText('Call Dash client one');
    await expect(activity).toContainText('Dash Marina listing');
    for (const secret of ['Dash hidden client', 'Dash hidden listing', 'Call Dash hidden client'])
      await expect(page.getByText(secret)).toHaveCount(0);
    await hero.getByRole('button', { name: 'Open client' }).click();
    await expect(page.getByRole('dialog', { name: 'Dash client one' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByLabel('Find a client').fill('nobody');
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
    await expect(page.locator('.client-desk-hero')).toContainText('Dash client one');
    const desk = page.locator('.client-desk');
    for (const name of ['Add to shortlist', 'Follow-up', 'Viewing'])
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
    await expect(page.locator('.client-desk-list')).toContainText('No clients found');
    await expect(page.locator('.client-desk-hero')).toHaveCount(0);
    const card = page.getByRole('region', { name: 'Clients on your follow-ups' });
    await expect(card).toContainText('Desk task client');
    await expect(card).toContainText(client.record.client_id);
    await expect(card.getByRole('link', { name: '+971500000088' })).toHaveAttribute(
      'href',
      'tel:+971500000088',
    );
    await expect(card.getByRole('link', { name: 'desk-task@client.test' })).toBeVisible();
    for (const secret of ['Private desk community', 'Private desk notes', '9,100,000', 'Edit'])
      await expect(page.locator('.client-desk')).not.toContainText(secret);
    await expect(page.getByRole('region', { name: /matching propert/ })).toHaveCount(0);
    await page.goto('/#/dashboard');
    const priorities = page.locator('.activity-panel').filter({ hasText: 'Your priorities' });
    await expect(priorities).toContainText(
      `${client.record.client_id} · Desk task client (not assigned to you)`,
    );
  } finally {
    await context.close();
  }
});
