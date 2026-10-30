import { test, expect } from './fixtures.js';
import { memberPage, signInMember } from './assign-helpers.js';
import {
  addressesCard,
  emailCard,
  openConnectForm,
  sendgridCompany,
  shots,
} from './sendgrid-helpers.js';

// Packet E3d: the Channels card and sending addresses for company email through the
// SendGrid stand-in (CRM_SENDGRID_ENDPOINT), with My mailbox showing the member's address.
test('an Admin connects SendGrid and manages a sending address', async ({
  page,
  browser,
}, testInfo) => {
  const company = await sendgridCompany('e3d-ui');
  await signInMember(page, company.admin.email);
  const form = await openConnectForm(page);
  await form.getByLabel('Display label').fill('Company email');
  await form.getByLabel('Company domain').fill('not a domain');
  await form.getByLabel('SendGrid API key').fill(company.key);
  await form.getByRole('button', { name: 'Connect account' }).click();
  await expect(form.getByRole('alert')).toContainText('Enter the domain only');
  await form.getByLabel('Company domain').fill(company.domain);
  await shots(page, testInfo, 'sendgrid-connect');
  await form.getByRole('button', { name: 'Connect account' }).click();
  await expect(page.getByText('Company email is connected.')).toBeVisible();

  const card = emailCard(page);
  await expect(card.getByText('Connected', { exact: true })).toBeVisible();
  await expect(card).toContainText(`Twilio SendGrid · Domain ${company.domain}`);
  await expect(card).not.toContainText(company.key);
  const status = card.getByRole('list', { name: 'SendGrid status' });
  await expect(status.getByRole('listitem').filter({ hasText: 'Delivery updates' })).toContainText(
    'On',
  );
  await expect(status.getByRole('listitem').filter({ hasText: 'Incoming mail' })).toContainText(
    'On',
  );

  const addresses = addressesCard(page);
  await expect(addresses).toContainText(`one address on ${company.domain}`);
  await expect(addresses).toContainText('No sending addresses yet.');
  await addresses.getByRole('button', { name: 'Add address' }).click();
  const add = addresses.getByRole('form', { name: 'Add a sending address' });
  await add.getByLabel('Team member').selectOption({ label: company.agent.name });
  await expect(add.getByLabel('Name clients see')).toHaveValue(company.agent.name);
  await expect(add).toContainText(`@${company.domain}`);
  await add.getByLabel('Address', { exact: true }).fill('postmaster');
  await add.getByRole('button', { name: 'Save address' }).click();
  await expect(add.getByRole('alert')).toContainText("kept for the company's mail system");
  await add.getByLabel('Address', { exact: true }).fill('agent.one');
  await add.getByLabel('Name clients see').fill('Agent One <boss>');
  await add.getByRole('button', { name: 'Save address' }).click();
  await expect(add.getByRole('alert')).toContainText('without @, quotes, angle brackets');
  await add.getByLabel('Name clients see').fill('Agent One · Keys');
  await shots(page, testInfo, 'sendgrid-add');
  await add.getByRole('button', { name: 'Save address' }).click();
  const address = `agent.one@${company.domain}`;
  await expect(addresses.getByText(`${address} is ready to send.`)).toBeVisible();
  const row = addresses.getByRole('listitem').filter({ hasText: address });
  await expect(row).toContainText('Active');
  await expect(row).toContainText(
    `Clients see “Agent One · Keys” · Belongs to ${company.agent.name}`,
  );

  await row.getByRole('button', { name: `Rename ${address}` }).click();
  await row.getByLabel('Name clients see').fill('Agent One');
  await row.getByRole('button', { name: 'Save name' }).click();
  await expect(addresses.getByText(`The name for ${address} is saved.`)).toBeVisible();
  await expect(row).toContainText('Clients see “Agent One”');
  await shots(page, testInfo, 'sendgrid-connected');

  // The member sees their own address on My mailbox, and no Google connect option.
  const member = await memberPage(browser, company.agent.email);
  await member.page.goto('/#/my-mailbox');
  const mine = member.page.getByRole('article', { name: 'Company email' });
  await expect(mine).toContainText('Your company email address');
  await expect(mine).toContainText(address);
  await expect(mine).toContainText('Clients see the name “Agent One”.');
  await expect(mine).toContainText('Google mailboxes are not used');
  await expect(member.page.getByRole('button', { name: 'Connect Google mailbox' })).toHaveCount(0);
  await shots(member.page, testInfo, 'sendgrid-mailbox');

  // Keeping the address for a former member is confirmed first and never reassigns it.
  await row.getByRole('button', { name: `Keep ${address} for a former member` }).click();
  const confirm = row.getByRole('group', { name: 'Keep for former member' });
  await expect(confirm).toContainText('It can never be given to anyone else');
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(row).toContainText('Active');
  await row.getByRole('button', { name: `Keep ${address} for a former member` }).click();
  await confirm.getByRole('button', { name: 'Keep for former member' }).click();
  await expect(addresses.getByText(`${address} is kept for a former member.`)).toBeVisible();
  await expect(row).toContainText('Kept for a former member');
  await expect(row).toContainText('It can only return to the same person.');
  // A kept address can no longer be renamed; only an unused one can still be removed.
  await expect(row.getByRole('button')).toHaveText(['Remove']);
  await member.page.reload();
  await expect(mine).toContainText('Ask your Admin for a sending address.');
  await expect(mine).toContainText('No address yet');
  await member.context.close();

  // The disconnect step names what the Admin must still do in SendGrid and at the registrar.
  await card.getByRole('button', { name: 'Disconnect', exact: true }).click();
  const off = card.getByRole('group', { name: 'Disconnect channel' });
  await expect(off).toContainText('delete the API key');
  await expect(off).toContainText("change the domain's MX record");
  await shots(page, testInfo, 'sendgrid-disconnect');
  await off.getByRole('button', { name: 'Disconnect channel' }).click();
  await expect(page.getByText('Company email is disconnected.')).toBeVisible();
  await expect(addressesCard(page)).toHaveCount(0);
  await expect(card).toContainText('Not connected yet.');
});
