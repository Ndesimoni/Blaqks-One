import { expect } from '@playwright/test';
import { landWhereTestsBegin, session } from './helpers.js';

export async function openTeam(page) {
  await page.goto('/#/team-access');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Team & access', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Invite teammate', exact: true })).toBeEnabled();
}

export async function startInvitation(page, suffix, admin = false) {
  await page.getByRole('button', { name: 'Invite teammate', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Invite teammate' });
  await dialog.getByLabel('Full name').fill(`Browser ${suffix}`);
  await dialog.getByLabel('Email address').fill(`${suffix}@browser-team.test`);
  await dialog.getByLabel('Phone number').fill('+971501234567');
  if (admin) await dialog.getByLabel('Account type').selectOption('admin');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  return dialog;
}

export async function finishInvitation(page, dialog) {
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await dialog.getByRole('button', { name: 'Create invitation', exact: true }).click();
  const ready = page.getByRole('dialog', { name: 'Invitation ready' });
  await expect(ready).toBeVisible();
  return ready.getByLabel('Activation link').inputValue();
}

export async function activateInNewContext(browser, link, email, password = 'Team123!') {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(link);
  // A brand-new browser loads the whole development bundle first; under parallel workers
  // that cold start can pass five seconds before the page renders (the API answers in ms).
  await expect(page.getByRole('heading', { name: /^Join / })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel('Choose a password').fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Join the team', exact: true }).click();
  // Joining signs the person in and opens their workspace (design queue item 34).
  await landWhereTestsBegin(page);
  expect((await session(page)).user.email).toBe(email);
  return { context, page };
}

export async function closeInvitation(page) {
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('dialog', { name: 'Invitation ready' })
    .getByRole('button', { name: 'Done', exact: true })
    .click();
}
