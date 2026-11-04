import { expect } from '@playwright/test';
import { landWhereTestsBegin, session } from './helpers.js';
import { saveRecordForm } from '../browser/helpers/record-form.js';
import { openPage } from './product-nav.js';
import { openName } from './record-open.js';

export const password = 'Team123!';

/** Records of the signed-in page's workspace, read through the same-origin API. */
export async function workspaceRecords(page) {
  const identity = await session(page);
  const workspace = identity.user.workspaceId || identity.user.id;
  const path = `/api/crm/workspaces/${workspace}/records`;
  const response = await page.request.get(path);
  expect(response.status()).toBe(200);
  return { identity, path, body: await response.json() };
}

/** Assigns a record as the signed-in page's user (the API used by the hand-off dialog). */
export async function assignInBrowser(page, collection, idKey, legacyId, assigneeId) {
  const { identity, path, body } = await workspaceRecords(page);
  const entry = body.records[collection].find((row) => row.record[idKey] === legacyId);
  const response = await page.request.put(`${path}/${collection}/${entry.id}/assignee`, {
    headers: { Origin: 'http://localhost:5175', 'X-CSRF-Token': identity.csrfToken },
    data: { version: entry.version, assigneeId },
  });
  expect(response.status()).toBe(200);
}

/** Signs a team-fixture member in through the real form in a fresh page. */
export async function signInMember(page, email) {
  await page.goto('/');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await landWhereTestsBegin(page);
}

export async function memberPage(browser, email) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInMember(page, email);
  return { context, page };
}

export async function openSection(page, name) {
  await openPage(page, name);
}

/** Opens record details from the current list by its visible ID. */
export async function openRecord(page, id) {
  await page.getByRole('button', { name: openName(id) }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function setTheme(page, theme) {
  await expect(page.getByRole('button', { name: /^Switch to (light|dark) mode$/ })).toBeVisible();
  if ((await page.locator('html').getAttribute('data-theme')) !== theme)
    await page.getByRole('button', { name: `Switch to ${theme} mode` }).click();
}

export async function noPageOverflow(page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    .toBe(true);
}

export { saveRecordForm };

/** New email lives in the Messages top bar's Create (approved mockup). */
export async function startNewEmail(page) {
  await page.getByRole('banner').getByRole('button', { name: 'Create', exact: true }).click();
  await page.locator('#create-panel').getByRole('button', { name: 'Email', exact: true }).click();
}
