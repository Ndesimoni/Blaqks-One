import { expect } from '@playwright/test';
import { openRecord } from './assign-helpers.js';

export {
  createLog,
  dealRef,
  insertLegacyLog,
  patchLog,
} from '../api/finance-deal-links-helpers.mjs';
export { DEAL_LINK_MISSING } from '../api/finance-deal-links-helpers.mjs';

export const DEAL_FIELD = 'Deal ID optional';
export const UNAVAILABLE = 'Linked deal unavailable';

/** Opens a log's details from the Interaction log list, closing any open details first. */
export async function openLog(page, logId) {
  const close = page.getByRole('button', { name: 'Close record details', exact: true });
  if (await close.count()) await close.click();
  await page.goto('/#/interaction-log');
  await expect(page.locator('.page-heading h1')).toBeVisible();
  return openRecord(page, logId);
}

/** The deal value shown in a log's details. */
export const detailDeal = (details) =>
  details.locator('.detail-field', { hasText: DEAL_FIELD }).locator('strong');

/** Opens the editor from a log's details and returns the form dialog. */
export async function editLog(page, details) {
  await details.getByRole('button', { name: 'Edit record', exact: true }).click();
  const form = page.getByRole('dialog');
  await expect(form.getByLabel(DEAL_FIELD, { exact: true })).toBeVisible();
  return form;
}

/** Visible option texts of the deal picker. */
export const dealOptions = (form) =>
  form.getByLabel(DEAL_FIELD, { exact: true }).locator('option').allTextContents();
