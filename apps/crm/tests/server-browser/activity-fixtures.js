import { expect } from '@playwright/test';
import { query } from '../api/helpers.mjs';
import { add, assign } from '../api/assignment-helpers.mjs';
import { createDeal, financeDealTeam } from './finance-deals-fixtures.js';

export { checkLayout, layouts, memberPage } from './finance-deals-fixtures.js';

/**
 * A fresh finance team through the API: the own-view agent adds two clients and a deal, then
 * the Admin hands one client to the second agent, so the agent's own entry for it is now
 * "Record unavailable". All names are synthetic.
 */
export async function activityTeam(prefix) {
  const team = await financeDealTeam(prefix);
  const { admin, agent, second } = team;
  const kept = await add(agent, 'Clients', { full_name: `Synthetic ${prefix} kept client` });
  const moved = await add(agent, 'Clients', { full_name: `Synthetic ${prefix} moved client` });
  const deal = await createDeal(agent, kept.record.client_id, {}, admin);
  const handed = await assign(admin, 'Clients', moved, second.user.id);
  if (handed.status !== 200) throw Error(JSON.stringify(handed.value));
  return { ...team, kept, moved, deal };
}

/**
 * Adds `count` "updated" entries by the Admin on one client, six seconds apart from now, so the
 * feed needs Load more and the entries collapse into one repeated row across both pages.
 */
export function busyDay(team, count) {
  const { admin, kept } = team;
  const workspace = admin.user.workspaceId;
  query(
    'INSERT INTO crm_activity (id,actor_id,workspace_id,action,collection,record_id,created_at) ' +
      `SELECT gen_random_uuid(),'${admin.user.id}','${workspace}','updated','Clients',` +
      `'${kept.id}', now() + g * interval '6 seconds' FROM generate_series(1,${count}) AS g`,
  );
}

/** Opens the activity screen and waits for the first page. */
export async function openActivity(page, heading, search = '') {
  await page.goto(`/#/team-activity${search}`);
  await expect(page.locator('.page-heading h1')).toHaveText(heading);
  await expect(page.getByText('Loading activity…')).toHaveCount(0);
  return page.getByRole('region', { name: 'Activity', exact: true });
}

/** The phrase of every visible entry, in order. */
export const phrases = (feed) => feed.locator('.activity-phrase').allInnerTexts();
