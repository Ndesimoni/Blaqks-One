import { test, expect } from './fixtures.js';
import { memberPage, workspaceRecords } from './assign-helpers.js';
import { dashboardTeam, held, metric } from './dashboard-fixtures.js';

/**
 * Cross-linked records around the dashboard team: one's client viewing two's listing, two's client
 * viewing one's listing (a listing-viewing projection only), a follow-up held directly by one on
 * two's client, and activity on each side.
 */
async function crossLinkedTeam(prefix) {
  const fixture = await dashboardTeam(prefix);
  const { team, one, mine, hidden, listing } = fixture;
  const other = await held(
    team,
    'Properties',
    { listing_title: 'Scope other listing' },
    team.people.two.id,
  );
  const clientOf = (entry) => entry.record.client_id;
  const propertyOf = (entry) => entry.record.property_id;
  for (const [client, property] of [
    [mine, other],
    [hidden, listing],
  ])
    await held(team, 'Viewings', {
      client_id: clientOf(client),
      property_id: propertyOf(property),
      appointment_date_time: '2099-03-04 11:00',
    });
  await held(
    team,
    'Follow-ups',
    { client_id: clientOf(hidden), next_action: 'Scope direct task', due_date: '2020-02-02' },
    one.id,
  );
  for (const client of [mine, hidden]) {
    await held(team, 'Shortlist', {
      client_id: clientOf(client),
      property_id: propertyOf(listing),
    });
    await held(team, 'Interaction log', {
      client_id: clientOf(client),
      conversation_topic: 'Scope',
    });
    await held(team, 'Client care', { client_id: clientOf(client), touchpoint_type: 'Call' });
  }
  return { ...fixture, other };
}

test('assigned-only dashboard figures equal the scoped /records payload and request no assignees', async ({
  browser,
}) => {
  const { one, two, mine, hidden, other } = await crossLinkedTeam('dashscope');
  const { page, context } = await memberPage(browser, one.email);
  const assigneeCalls = [];
  page.on('request', (request) => {
    if (/\/assignees/.test(request.url())) assigneeCalls.push(request.url());
  });
  try {
    await page.goto('/#/dashboard');
    const panel = page.getByRole('region', { name: 'Records in view' });
    await expect(panel.getByRole('button').first()).toBeVisible();
    const { body } = await workspaceRecords(page);
    expect(body.scope).toBe('assigned');
    const records = body.records;
    const ids = (name, key) => records[name].map((row) => row.record[key]);
    expect(ids('Clients', 'client_id')).toEqual([mine.record.client_id]);
    for (const name of ['Viewings', 'Shortlist', 'Interaction log', 'Client care'])
      expect(ids(name, 'client_id')).not.toContain(hidden.record.client_id);
    expect(body.listingViewings.length).toBeGreaterThan(0);
    // Every collection total in the panel equals the payload, for each section shown.
    const labels = await panel
      .getByRole('button')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
    expect(labels.length).toBeGreaterThanOrEqual(4);
    for (const label of labels) {
      const [, name, count] = label.match(/^(.+): (\d+) records?$/);
      expect(Number(count), name).toBe(records[name].length);
    }
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = records.Viewings.filter(
      (row) => String(row.record.appointment_date_time).slice(0, 10) >= today,
    );
    expect(upcoming).toHaveLength(2);
    expect(records['Follow-ups']).toHaveLength(2);
    await expect(metric(page, 'ACTIVE LEADS')).toHaveText(String(records.Clients.length));
    await expect(metric(page, 'PROPERTIES')).toHaveText(String(records.Properties.length));
    await expect(metric(page, 'FOLLOW-UPS DUE')).toHaveText(String(records['Follow-ups'].length));
    await expect(metric(page, 'UPCOMING VIEWINGS')).toHaveText(String(upcoming.length));
    const sum = async (heading) =>
      (
        await page
          .locator('.panel')
          .filter({ hasText: heading })
          .locator('.bar-label strong')
          .allTextContents()
      )
        .map(Number)
        .reduce((a, b) => a + b, 0);
    expect(await sum('Lead pipeline')).toBe(records.Clients.length);
    expect(await sum('Where leads come from')).toBe(records.Clients.length);
    // Hidden records appear only as the server's permitted labels, never with other details.
    const priorities = page.locator('.activity-panel').filter({ hasText: 'Your priorities' });
    await expect(priorities).toContainText(
      `${hidden.record.client_id} · Dash hidden client (not assigned to you)`,
    );
    const viewings = page.locator('.next-viewings');
    await expect(viewings).toContainText(
      `${other.record.property_id} · Scope other listing (not assigned to you)`,
    );
    await expect(viewings.locator('button.viewing-mini')).toHaveCount(2);
    // Two's viewing on one's listing appears only as the permitted time and agent.
    const heldRow = viewings.locator('.viewing-mini-held');
    await expect(heldRow).toHaveCount(1);
    await expect(heldRow).toContainText(`11:00 · Booked by ${two.name}`);
    await expect(heldRow).not.toContainText('Dash hidden client');
    await expect(page.getByText('Linked record unavailable')).toHaveCount(0);
    await expect(page.getByLabel('Assigned to', { exact: true })).toHaveCount(0);
    await expect(page.getByText(two.name)).toHaveCount(1);
    expect(assigneeCalls).toEqual([]);
  } finally {
    await context.close();
  }
});

test('an Admin narrowed to one workload still names linked records held by others', async ({
  browser,
}) => {
  const { team, one, other } = await crossLinkedTeam('dashnames');
  const { page, context } = await memberPage(browser, team.people.admin.email);
  try {
    await page.goto('/#/dashboard');
    const viewings = page.locator('.next-viewings');
    await page.getByLabel('Assigned to', { exact: true }).selectOption({ label: one.name });
    await expect(page.getByText('Figures for the selected workload')).toBeVisible();
    await expect(metric(page, 'UPCOMING VIEWINGS')).toHaveText('2');
    // The Admin can open this listing, so it must not be reported as unavailable.
    await expect(viewings).toContainText('Scope other listing');
    await expect(viewings).not.toContainText(
      `${other.record.property_id} · Linked record unavailable`,
    );
  } finally {
    await context.close();
  }
});
