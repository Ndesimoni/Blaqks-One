import { test, expect } from './fixtures.js';
import { assignTeam, held } from './assign-fixtures.js';
import { memberPage, openRecord, workspaceRecords } from './assign-helpers.js';

test("a directly assigned follow-up shows only the client's name, phone and email", async ({
  browser,
}) => {
  const team = await assignTeam('taskcard');
  const { one } = team.people;
  const client = await held(team, 'Clients', {
    full_name: 'Task card client',
    phone: '+971500000077',
    email: 'task-card@client.test',
    preferred_communities: 'Private community',
    notes: 'Private budget notes',
  });
  const task = await held(
    team,
    'Follow-ups',
    { client_id: client.record.client_id, next_action: 'Call about keys' },
    one.id,
  );
  const { page, context } = await memberPage(browser, one.email);
  try {
    await page.goto('/#/clients');
    await expect(page.getByText('Task card client', { exact: true })).toHaveCount(0);
    await page.goto('/#/follow-ups');
    const details = await openRecord(page, task.record.activity_id);
    await expect(details.getByRole('region', { name: 'Assigned to' })).toContainText('You');
    const card = details.getByRole('region', { name: 'Client contact' });
    await expect(card).toContainText('Task card client');
    await expect(card).toContainText(`${client.record.client_id} · Not assigned to you.`);
    await expect(card.getByRole('link', { name: '+971500000077' })).toHaveAttribute(
      'href',
      'tel:+971500000077',
    );
    await expect(card.getByRole('link', { name: 'task-card@client.test' })).toHaveAttribute(
      'href',
      'mailto:task-card@client.test',
    );
    await expect(details).not.toContainText('Private community');
    await expect(details).not.toContainText('Private budget notes');
    await details.getByRole('button', { name: 'Edit record', exact: true }).click();
    const link = page.getByRole('dialog').getByLabel('Client ID', { exact: true });
    await expect(link).toBeDisabled();
    await expect(link.locator('option:checked')).toHaveText(
      `${client.record.client_id} · Task card client (not assigned to you)`,
    );
    await expect(page.getByRole('dialog')).toContainText(
      "Only the client's assignee can change this link.",
    );
    const { body } = await workspaceRecords(page);
    expect(body.records.Clients).toEqual([]);
    expect(Object.keys(body.taskClients[0]).sort()).toEqual([
      'client_id',
      'email',
      'full_name',
      'phone',
    ]);
  } finally {
    await context.close();
  }
});

test('the holder of a listing sees other agents’ viewings as date/time and agent only', async ({
  browser,
}) => {
  const team = await assignTeam('listing');
  const { one, two } = team.people;
  const property = await held(team, 'Properties', { listing_title: 'Held listing' }, one.id);
  const buyer = await held(team, 'Clients', { full_name: 'Secret buyer' }, two.id);
  const queued = await held(team, 'Clients', { full_name: 'Queued buyer' }, null);
  for (const [client, time] of [
    [buyer, '2026-11-02 10:00'],
    [queued, '2026-11-03 15:30'],
  ]) {
    await held(team, 'Viewings', {
      client_id: client.record.client_id,
      property_id: property.record.property_id,
      appointment_date_time: time,
      client_feedback: 'Private viewing feedback',
    });
  }
  const { page, context } = await memberPage(browser, one.email);
  try {
    await page.goto('/#/viewings');
    await expect(page.getByRole('navigation', { name: 'Viewings pages' })).toContainText('of 0');
    await page.goto('/#/properties');
    await page.getByRole('button', { name: /Held listing/ }).click();
    const details = page.getByRole('dialog', { name: 'Held listing' });
    const section = details.getByRole('region', { name: "Other agents' viewings" });
    const items = section.getByRole('list', { name: 'Booked viewings' }).getByRole('listitem');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toHaveText(/^02 Nov 2026 · 10:00 · Synthetic listing-two$/);
    await expect(items.nth(1)).toHaveText(/^03 Nov 2026 · 15:30 · Unassigned$/);
    await expect(section).toContainText('Client details stay with the responsible agent.');
    for (const secret of ['Secret buyer', 'Queued buyer', 'Private viewing feedback', 'VW-'])
      await expect(details).not.toContainText(secret);
    expect(two.name).toBe('Synthetic listing-two');
  } finally {
    await context.close();
  }
});
