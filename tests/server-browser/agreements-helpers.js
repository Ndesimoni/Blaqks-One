import { expect } from '@playwright/test';
import { noPageOverflow, setTheme } from './assign-helpers.js';

export async function openAgreements(page) {
  await page.goto('/#/agreements');
  await expect(page.getByRole('heading', { level: 1, name: 'Agreements' })).toBeVisible();
}

/** The agreement row with this synthetic listing label. */
export const agreementRow = (page, listing) => page.locator('.agreement-row', { hasText: listing });

/**
 * Drafts a co-broking agreement through every form step for the member with `email`,
 * then saves it; the new draft's detail opens.
 */
export async function draftCoBroking(page, { email, recipientName, listing, share, onReview }) {
  await page.getByRole('button', { name: 'New agreement' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: /^Co-broking/ }).check();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByText('Find the person who will receive this agreement.')).toBeVisible();
  await dialog.getByLabel(/Recipient.s email/).fill('nobody@crm-fixture.test');
  await dialog.getByRole('button', { name: 'Find' }).click();
  await expect(dialog.getByRole('alert')).toContainText('No active member of another company');
  await dialog.getByLabel(/Recipient.s email/).fill(email);
  await dialog.getByRole('button', { name: 'Find' }).click();
  await expect(dialog.locator('.agreement-recipient')).toContainText(recipientName);
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByLabel('Community or area').fill('Dubai Marina');
  await dialog.getByLabel('Bedrooms').fill('2');
  await dialog.getByLabel('Built-up area (sq ft)').fill('1100');
  await dialog.getByLabel('Asking price (AED)').fill('2,100,000');
  await dialog.getByLabel('Listing label').fill(listing);
  await dialog.getByLabel('Client name').fill('Synthetic K.');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByLabel('Agreed amount (AED)').fill('52500');
  await dialog.getByLabel(/Sending side.s share/).fill(String(share));
  await expect(dialog.locator('.agreement-split')).toContainText(`${100 - share}%`);
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.locator('.agreement-review')).toContainText('AED 52,500.00');
  await expect(dialog.locator('.agreement-review')).toContainText(`${share}%`);
  await onReview?.();
  await dialog.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('dialog').locator('.agreement-status')).toContainText('Draft');
}

/** Confirms one command from the detail footer and waits for the server's answer. */
export async function confirmAction(page, action, confirm, state) {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: action, exact: true }).click();
  await dialog.locator('.agreement-confirm').getByRole('button', { name: confirm }).click();
  await expect(dialog.locator('.agreement-status')).toContainText(state);
}

/** The theme toggle sits behind an open modal, so a dialog is shown in each theme directly. */
async function showTheme(page, theme) {
  if (!(await page.locator('dialog[open]').count())) return setTheme(page, theme);
  await page.evaluate((value) => {
    document.documentElement.dataset.theme = value;
  }, theme);
}

/** Screenshots at 1280 and 390 in both themes, checking that the page never scrolls sideways. */
export async function shots(page, testInfo, name) {
  const original = await page.locator('html').getAttribute('data-theme');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await showTheme(page, theme);
      await page.waitForTimeout(250);
      await noPageOverflow(page);
      await page.screenshot({ path: testInfo.outputPath(`${name}-${width}-${theme}.png`) });
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  if (await page.locator('dialog[open]').count()) await showTheme(page, original);
}
