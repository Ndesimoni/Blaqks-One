import { expect } from '@playwright/test';

export async function chooseFormSection(page, name) {
  const dialog = page.getByRole('dialog');
  const choice = dialog.getByRole('button', { name, exact: true });
  await choice.click();
}

/** Complete optional sections through the same controls used by a person. */
export async function saveRecordForm(page) {
  const dialog = page.getByRole('dialog');
  const next = dialog.getByRole('button', { name: 'Next', exact: true });
  for (let index = 0; index < 10 && (await next.count()); index++) {
    const progress = dialog.locator('.form-progress');
    const before = await progress.textContent();
    await next.click();
    await expect(progress).not.toHaveText(before);
  }
  await dialog.getByRole('button', { name: /^(Create record|Save changes)$/ }).click();
}
