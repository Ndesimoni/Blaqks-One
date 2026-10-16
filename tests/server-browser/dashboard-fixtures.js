import { expect } from '@playwright/test';
import { assignTeam, held } from './assign-fixtures.js';

export { assignTeam, held };

/**
 * A fresh team where agent `one` holds one client, listing, follow-up and viewing and agent `two`
 * holds a matching private set. Agent one must never see or count two's records.
 */
export async function dashboardTeam(prefix) {
  const team = await assignTeam(prefix);
  const { one, two } = team.people;
  const mine = await held(
    team,
    'Clients',
    {
      full_name: 'Dash client one',
      phone: '+971500000101',
      email: 'dash-one@client.test',
      lead_stage: 'Qualified',
      lead_source: 'Bayut',
      buy_rent: 'Buy',
      maximum_budget_aed: '2000000',
      preferred_communities: 'Dubai Marina',
    },
    one.id,
  );
  const hidden = await held(
    team,
    'Clients',
    { full_name: 'Dash hidden client', lead_stage: 'New', lead_source: 'Referral' },
    two.id,
  );
  const listing = await held(
    team,
    'Properties',
    {
      listing_title: 'Dash Marina listing',
      listing_status: 'Available',
      sale_rental: 'Sale',
      price_annual_rent_aed: '1800000',
      community: 'Dubai Marina',
    },
    one.id,
  );
  const other = await held(team, 'Properties', { listing_title: 'Dash hidden listing' }, two.id);
  for (const [client, action] of [
    [mine, 'Call Dash client one'],
    [hidden, 'Call Dash hidden client'],
  ])
    await held(team, 'Follow-ups', {
      client_id: client.record.client_id,
      next_action: action,
      due_date: '2020-01-01',
      contact_date: '2020-01-01',
    });
  for (const [client, property] of [
    [mine, listing],
    [hidden, other],
  ])
    await held(team, 'Viewings', {
      client_id: client.record.client_id,
      property_id: property.record.property_id,
      appointment_date_time: '2099-01-02 10:00',
    });
  return { team, one, two, mine, hidden, listing };
}

/** A key figure's value by its label. */
export const metric = (page, name) =>
  page.locator('.key-figure').filter({ hasText: name }).locator('.key-figure-value');

/** The Dashboard agenda's follow-up ("priorities") and upcoming-viewing groups. */
export const priorities = (page) => page.locator('[data-agenda="follow-ups"]');
export const viewingsPanel = (page) => page.locator('[data-agenda="viewings"]');

/** A Dashboard section by its label (the section's heading). */
export const dashSection = (page, name) => page.getByRole('region', { name, exact: true });

/** Expected totals in the Records in view panel. */
export async function expectCounts(page, counts) {
  const panel = page.getByRole('region', { name: 'Records in view' });
  for (const [name, count] of Object.entries(counts))
    await expect(
      panel.getByRole('button', {
        name: `${name}: ${count} ${count === 1 ? 'record' : 'records'}`,
        exact: true,
      }),
    ).toBeVisible();
}
