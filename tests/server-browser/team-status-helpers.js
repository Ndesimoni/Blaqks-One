import { expect } from '@playwright/test';

export function teamCard(page, name) {
  return page.locator('[data-member-id]').filter({
    has: page.getByRole('heading', { name, exact: true }),
  });
}

export async function openMemberActions(page, name) {
  await teamCard(page, name).getByRole('button', { name: `More actions for ${name}` }).click();
  const dialog = page.getByRole('dialog', { name: `${name} account actions`, exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function clickMemberAction(page, name, label) {
  const dialog = await openMemberActions(page, name);
  await dialog.getByRole('button', { name: label, exact: true }).click();
}

export async function changeAccountStatus(page, name, action) {
  page.once('dialog', (confirmation) => confirmation.accept());
  await clickMemberAction(page, name, `${action} account for ${name}`);
  await expect(teamCard(page, name)).toContainText(action === 'Suspend' ? 'Suspended' : 'Active');
}

export async function signInActivatedMember(page, email) {
  await page.goto('/');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Team123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Clients & requirements' })).toBeVisible();
}

export async function expectSuspended(page, email) {
  await page.reload();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Team123!');
  const [response] = await Promise.all([
    page.waitForResponse((reply) => reply.url().endsWith('/api/crm/auth/login')),
    page.getByRole('button', { name: 'Sign in', exact: true }).click(),
  ]);
  expect(response.status()).toBe(401);
  await expect(page.getByLabel('Email address')).toBeVisible();
}
