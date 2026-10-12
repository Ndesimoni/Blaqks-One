import { expect, test } from './helpers/session.js';
import { chooseFormSection, saveRecordForm } from './helpers/record-form.js';

test('editing can jump between sections and final validation returns to an invalid hidden field', async ({
  page,
}) => {
  await page.goto('/#/clients');
  await expect
    .poll(() => page.evaluate(() => Boolean(localStorage.getItem('kws-crm-v1:workspace:aidah'))))
    .toBe(true);
  await page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem('kws-crm-v1:workspace:aidah'));
    workspace.data.Clients[0].minimum_budget_aed = 500;
    workspace.data.Clients[0].maximum_budget_aed = 100;
    localStorage.setItem('kws-crm-v1:workspace:aidah', JSON.stringify(workspace));
  });
  await page.reload();
  await page.locator('.data-table tbody tr').first().click();
  await page.getByRole('button', { name: 'Edit record', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await chooseFormSection(page, 'Step 6: Review & save');
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(dialog.locator('.form-progress')).toContainText('Step 3 of 6');
  await expect(page.locator('#maximum_budget_aed')).toBeFocused();
  await page.locator('#maximum_budget_aed').fill('900');
  await chooseFormSection(page, 'Step 6: Review & save');
  await saveRecordForm(page);
  await expect(dialog).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('kws-crm-v1:workspace:aidah')).data.Clients[0]
          .maximum_budget_aed,
    ),
  ).toBe('900');
});

test('deal review distinguishes monetary amounts from commission and split percentages', async ({
  page,
}) => {
  await page.goto('/#/deals');
  await page.getByRole('button', { name: 'Add deal', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const next = dialog.getByRole('button', { name: 'Next', exact: true });
  await next.click();
  await page.locator('#agreed_value_aed').fill('1000000');
  await page.locator('#fee_basis').selectOption('Percentage');
  await page.locator('#fee_rate').fill('2');
  await page.locator('#partner_share').fill('10');
  await page.locator('#your_share').fill('50');
  await next.click();
  await next.click();
  await next.click();
  const section = dialog.getByRole('region', { name: 'Commission & payments', exact: true });
  await expect(section.getByText('2%', { exact: true })).toBeVisible();
  await expect(section.getByText('10%', { exact: true })).toBeVisible();
  await expect(section.getByText('50%', { exact: true })).toBeVisible();
  await expect(section.locator('dd').first()).toContainText('1,000,000');
  await saveRecordForm(page);
  await expect(dialog).toHaveCount(0);
});
