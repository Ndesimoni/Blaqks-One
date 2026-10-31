import { expect } from '@playwright/test';
import { day, financePath, financeTeams, settingsBody } from '../api/finance-helpers.mjs';
import { findMember } from '../api/team-helpers.mjs';
import { memberPage, noPageOverflow, setTheme } from './assign-helpers.js';
import { editTeammate, LABELS, moduleBox, ticks } from './permissions-fixtures.js';

export { day, editTeammate, findMember, LABELS, memberPage, moduleBox, noPageOverflow, setTheme };
export { ticks };

/**
 * A fresh Admin team through the API (finance-design §14): an own-view Property Agent
 * ("agent") and a Receptionist ("desk"). Browser members sign in with the team password.
 */
export async function teamFinance(prefix) {
  const team = await financeTeams(prefix);
  const person = (who) => ({
    email: `${prefix}-${who}@team-fixture.test`,
    name: `Synthetic ${prefix}-${who}`,
    id: team[who].user.id,
  });
  return {
    ...team,
    people: Object.fromEntries(['admin', 'agent', 'desk'].map((who) => [who, person(who)])),
  };
}

/** Saves team settings as the Admin through the API and returns the saved settings. */
export async function saveSettings(team, changes = {}) {
  const { admin } = team;
  const current = await admin.request(financePath(admin));
  const version = current.value.settings?.version ?? null;
  const result = await admin.request(financePath(admin, '/settings'), {
    method: 'PUT',
    body: settingsBody({ ...changes, version }),
  });
  expect(result.status, JSON.stringify(result.value)).toBe(200);
  return result.value.settings;
}

/** The team's settings as the API returns them (null before setup). */
export async function storedSettings(team) {
  const result = await team.admin.request(financePath(team.admin));
  expect(result.status).toBe(200);
  return result.value.settings;
}

/** All agreements of the team, oldest first per agent. */
export async function storedAgreements(team) {
  const result = await team.admin.request(financePath(team.admin, '/agreements'));
  expect(result.status).toBe(200);
  return result.value.agreements;
}

/** Opens Team & access → Finance settings and waits for the settings panel. */
export async function openFinanceSettings(page) {
  await page.goto('/#/team-access');
  const tabs = page.getByRole('group', { name: 'Team & access views' });
  await tabs.getByRole('button', { name: 'Finance settings', exact: true }).click();
  await expect(tabs.getByRole('button', { name: 'Finance settings' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const panel = page.getByRole('region', { name: 'Commission split and VAT' });
  await expect(panel).toBeVisible();
  return panel;
}

/** The two sensitive finance ticks inside the Finance "What they can do" group. */
export function financeTicks(dialog) {
  const group = ticks(dialog, 'Finance');
  return {
    group,
    view: group.getByRole('checkbox', { name: 'See team finance', exact: true }),
    approve: group.getByRole('checkbox', { name: 'Approve payments & expenses', exact: true }),
  };
}

export const SCOPE = {
  team: "Whole team's records",
  assigned: 'Only records assigned to them',
};
