import { expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { dealPath, dealTeams } from '../api/finance-deals-helpers.mjs';
import { memberPage, noPageOverflow } from './assign-helpers.js';

export { createDeal, earnDeal, heldClient } from '../api/finance-deals-helpers.mjs';
export { memberPage, noPageOverflow };

/** AED text exactly as the CRM formats fils. */
export const aed = (fils) =>
  `AED ${(BigInt(fils) / 100n).toLocaleString('en-US')}.${String(BigInt(fils) % 100n).padStart(2, '0')}`;

/**
 * A fresh finance team through the API (finance-design §15): settings at 50% with VAT and a
 * 20% referral cap, two own-view Property Agents ("agent", "second"), an approver and a team
 * viewer. Browser members sign in with the team-fixture password.
 */
export async function financeDealTeam(prefix, settings = {}) {
  const team = await dealTeams(prefix, { maxReferralShareBp: 2000, ...settings });
  const person = (who) => ({
    email: `${prefix}-${who}@team-fixture.test`,
    name: `Synthetic ${prefix}-${who}`,
    id: team[who].user.id,
  });
  return {
    ...team,
    people: Object.fromEntries(['admin', 'agent', 'second'].map((who) => [who, person(who)])),
  };
}

/** Admin API call on a deal (split, earn …) with the server's exact body. */
export async function dealCall(team, deal, method, suffix, body) {
  const result = await team.admin.request(dealPath(team.admin, `/${deal.id}${suffix}`), {
    method,
    body: { version: deal.version, ...body },
  });
  if (result.status !== 200) throw Error(JSON.stringify(result.value));
  return result.value.deal;
}

/** Opens Deals in a signed-in page and waits for the connected screen. */
export async function openDeals(page) {
  await page.goto('/#/deals');
  await expect(page.locator('.page-heading h1')).toHaveText('Deals & commissions');
  await expect(page.getByRole('region', { name: 'Deals connection status' })).toHaveCount(0);
}

export const openDeal = async (page, dealId) => {
  await page.getByRole('button', { name: `Open deal ${dealId}`, exact: true }).click();
  const details = page.getByRole('dialog', { name: dealId, exact: true });
  await expect(details).toBeVisible();
  return details;
};

const shotsDir = process.env.FINANCE_SHOTS_DIR;

/** Saves a screenshot for visual review when FINANCE_SHOTS_DIR is set (never in CI). */
export async function shoot(page, name) {
  if (!shotsDir) return;
  mkdirSync(shotsDir, { recursive: true });
  await page.screenshot({ path: join(shotsDir, `${name}.png`), fullPage: false });
}

/** Each viewport and theme the Deals screens are checked in. */
export const layouts = [
  ['desktop', 1280, 900, 'dark'],
  ['desktop', 1280, 900, 'light'],
  ['mobile', 390, 844, 'dark'],
  ['mobile', 390, 844, 'light'],
];

/**
 * Applies one layout, checks the page never scrolls sideways, and records a screenshot. The
 * theme attribute is set directly so open dialogs (which make the header inert) stay open.
 */
export async function checkLayout(page, [label, width, height, theme], name) {
  await page.setViewportSize({ width, height });
  await page.evaluate((value) => {
    document.documentElement.dataset.theme = value;
    document.documentElement.style.colorScheme = value;
  }, theme);
  // Let the shared colour transitions settle before checking and capturing.
  await page.waitForTimeout(400);
  await noPageOverflow(page);
  await shoot(page, `${name}-${label}-${theme}`);
}
