import { expect } from '@playwright/test';

export async function openWorkspacePicker(page) {
  await page.getByRole('button', { name: 'Workspace', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose workspace', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function selectWorkspace(page, name) {
  const dialog = await openWorkspacePicker(page);
  await dialog.getByLabel('Search workspaces', { exact: true }).fill(name);
  const label = /\bworkspace$/i.test(name) ? `Open ${name}` : `Open ${name} workspace`;
  await dialog.getByRole('button', { name: label, exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
