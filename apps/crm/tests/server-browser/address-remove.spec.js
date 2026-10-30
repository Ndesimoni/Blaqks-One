import { test, expect } from './fixtures.js';
import { signInMember } from './assign-helpers.js';
import { addAddress, connectSendgrid } from '../api/sendgrid-helpers.mjs';
import { addressesCard, sendgridCompany, shots } from './sendgrid-helpers.js';

// Owner decision 2026-10-21: an address given by mistake is removed while still unused,
// and the Admin can then give the freed name to themselves.
test('the Admin removes an unused address and gives its name to themselves', async ({
  page,
}, testInfo) => {
  const company = await sendgridCompany('e3d-remove');
  const { session, domain } = company;
  expect((await connectSendgrid(session, domain)).status).toBe(201);
  expect((await addAddress(session, company.agentId, 'aidah', 'Aidah')).status).toBe(201);
  await signInMember(page, company.admin.email);
  await page.goto('/#/channels');
  const card = addressesCard(page);
  await card.getByRole('button', { name: `Remove aidah@${domain}` }).click();
  await expect(card).toContainText('never been used with clients');
  await shots(page, testInfo, 'address-remove');
  await card.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(card).toContainText(`aidah@${domain} was removed.`);
  await expect(card.getByText(`aidah@${domain}`, { exact: true })).toHaveCount(0);
  // The Admin is offered first and can now take the freed name.
  await card.getByRole('button', { name: 'Add address' }).click();
  await expect(card.getByLabel('Team member')).toContainText(company.admin.name);
  await card.getByLabel('Team member').selectOption({ label: company.admin.name });
  await card.getByLabel('Address', { exact: true }).fill('aidah');
  await card.getByLabel('Name clients see').fill('Aidah · Keys');
  await card.getByRole('button', { name: 'Save address' }).click();
  await expect(card.getByText(`aidah@${domain}`, { exact: true })).toBeVisible();
});
