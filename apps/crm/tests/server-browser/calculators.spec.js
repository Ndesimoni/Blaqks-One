import { test, expect } from './fixtures.js';
import { query } from '../api/helpers.mjs';
import { session, signIn } from './helpers.js';
import { clearInbox } from './inbox-fixtures.js';

const NAME = 'Synthetic Calculator Client';
const result = (page) => page.getByRole('region', { name: 'Result', exact: true });
const row = (page, label) => result(page).locator('.calc-row', { hasText: label });

test('one calculator at a time, with its Result, a copied summary and kept figures', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signIn(page);
  await page.goto('/#/calculators');
  const picker = page.getByRole('group', { name: 'Calculator', exact: true });
  await expect(picker.getByRole('button')).toHaveText([
    'Purchase costs',
    'Mortgage',
    'Rental yield',
    'Off-plan plan',
  ]);
  await expect(picker.getByRole('button', { name: 'Purchase costs' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const purchase = page.getByRole('region', { name: 'Purchase costs', exact: true });
  const copy = page.getByRole('button', { name: 'Copy summary', exact: true });
  await expect(copy).toBeDisabled();
  await purchase.getByLabel(/^Price/).fill('2400000');
  await expect(row(page, 'Land Department fee')).toContainText('AED 96,000');
  await expect(row(page, 'Total costs')).toContainText('AED 146,400');
  await expect(row(page, 'Cash needed with the price')).toContainText('AED 2,546,400');
  await copy.click();
  await expect(page.getByText('Summary copied.')).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('Purchase costs\nPrice: AED 2,400,000');
  expect(text).toContain('Total costs: AED 146,400');

  await picker.getByRole('button', { name: 'Mortgage' }).click();
  await expect(purchase).toBeHidden();
  const mortgage = page.getByRole('region', { name: 'Mortgage', exact: true });
  await mortgage.getByLabel(/^Price/).fill('2400000');
  await expect(mortgage.getByLabel(/^Down payment/)).toHaveValue('20');
  await expect(row(page, 'Loan')).toContainText('AED 1,920,000');
  await expect(row(page, 'Monthly payment')).toContainText('AED 10,134.4');
  await picker.getByRole('button', { name: 'Purchase costs' }).click();
  await expect(purchase.getByLabel(/^Price/)).toHaveValue('2400000');

  await picker.getByRole('button', { name: 'Off-plan plan' }).click();
  const offPlan = page.getByRole('region', { name: 'Off-plan plan', exact: true });
  await offPlan.getByLabel(/^Price/).fill('1600000');
  await expect(row(page, 'Booking · 20%')).toContainText('AED 320,000');
  await expect(row(page, 'Shares total 100%')).toContainText('Ready to share');
  const download = page.getByRole('button', { name: 'Download schedule' });
  await expect(download).toBeEnabled();
  await offPlan.getByLabel('Share %').nth(1).fill('30');
  await expect(row(page, 'Shares total 90%')).toContainText('Must total 100%');
  await expect(download).toBeDisabled();
  await expect(copy).toBeDisabled();
});

test('Send to a client writes the summary in a new email, then opens it', async ({ page }) => {
  test.setTimeout(120000);
  await signIn(page);
  const identity = await session(page);
  const workspace = identity.user.workspaceId;
  clearInbox(workspace);
  query(
    `UPDATE integrations.crm_channel_connections SET state='disconnected',credential_sealed=NULL,
     credential_key_version=NULL,credential_updated_at=NULL WHERE workspace_id='${workspace}'
     AND owner_member_id='${identity.user.id}' AND channel='email'`,
  );
  const created = await page.request.post(`/api/crm/workspaces/${workspace}/records/Clients`, {
    headers: { Origin: 'http://localhost:5175', 'X-CSRF-Token': identity.csrfToken },
    data: { record: { full_name: NAME, email: 'calculator.client@example.test' } },
  });
  expect(created.status()).toBe(201);
  await page.goto('/#/my-mailbox');
  await page.getByRole('button', { name: 'Connect Google mailbox' }).click();
  await page.getByLabel('Mailbox address').fill('calculator@keys-fixture.test');
  await page.getByRole('button', { name: 'Allow the CRM to send and read email' }).click();
  await expect(page.getByText('Your mailbox is connected.')).toBeVisible();

  await page.goto('/#/calculators');
  await page.reload();
  const yieldChip = page.getByRole('button', { name: 'Rental yield', exact: true });
  await yieldChip.click();
  const rental = page.getByRole('region', { name: 'Rental yield', exact: true });
  await rental.getByLabel(/^Price/).fill('1850000');
  await rental.getByLabel(/^Annual rent/).fill('140000');
  await expect(row(page, 'Gross yield')).toContainText('7.57%');
  await page.getByRole('button', { name: 'Send to a client', exact: true }).click();
  const writing = page.getByRole('dialog', { name: 'New email', exact: true });
  await expect(writing.getByLabel('Subject')).toHaveValue('Rental yield estimate');
  await expect(writing.getByLabel('Message')).toHaveValue(/Gross yield: 7\.57%/);
  await writing.getByLabel('To').fill('Calculator Client');
  await writing.getByRole('button', { name: new RegExp(NAME) }).click();
  await writing.getByRole('button', { name: 'Send email' }).click();
  await expect(writing).toHaveCount(0);
  const messenger = page.getByRole('dialog', { name: 'Client inbox', exact: true });
  await expect(messenger.locator('.inbox-thread')).toContainText('Gross yield: 7.57%');
});
