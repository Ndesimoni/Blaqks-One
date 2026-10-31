import { expect } from '@playwright/test';
import { approvalTeams } from '../api/finance-approval-helpers.mjs';
import { overview } from '../api/finance-deals-helpers.mjs';

export { decided, expenseBody, paymentBody, submit } from '../api/finance-approval-helpers.mjs';
export { aed, checkLayout, layouts, memberPage, shoot } from './finance-deals-fixtures.js';
export { overview };

/**
 * A fresh approval team through the API (finance-design §16): settings at 50% with VAT, an
 * own-view Property Agent holding one earned deal (net AED 49,000.00), a second agent, two
 * approvers (team view + approve) and a team viewer. Members sign in with the team password.
 */
export async function approvalTeam(prefix) {
  const team = await approvalTeams(prefix);
  const email = (who) => `${prefix}-${who}@team-fixture.test`;
  const people = Object.fromEntries(
    ['admin', 'agent', 'second', 'approver', 'approver2', 'viewer'].map((who) => [
      who,
      { email: email(who), id: team[who].user.id, name: team[who].user.name },
    ]),
  );
  return { ...team, people };
}

const headings = { payments: 'Commission receipts', expenses: 'Business expenses' };

/** Opens Payments or Expenses (optionally on the approval queue) and waits for the list. */
export async function openEntries(page, kind, { queue = false } = {}) {
  await page.goto(`/#/${kind}${queue ? '?q=awaiting-approval' : ''}`);
  await expect(page.locator('.page-heading h1')).toHaveText(headings[kind]);
  await expect(page.getByRole('region', { name: /connection status/ })).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: /^Loading/ })).toHaveCount(0);
}

/** The desktop table row for one record ID. */
export const entryRow = (page, kind, code) =>
  page
    .getByRole('table', { name: kind === 'payments' ? 'Payments' : 'Expenses' })
    .getByRole('row')
    .filter({ hasText: code });

/** Opens a row's details dialog by its record ID. */
export async function openEntry(page, code) {
  await page
    .getByRole('button', { name: `Open ${code}`, exact: true })
    .first()
    .click();
  const details = page.getByRole('dialog', { name: code, exact: true });
  await expect(details).toBeVisible();
  return details;
}

/** Fills and submits a reason dialog (reject or void). */
export async function giveReason(page, title, reason, submit) {
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Reason').fill(reason);
  await dialog.getByRole('button', { name: submit, exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
