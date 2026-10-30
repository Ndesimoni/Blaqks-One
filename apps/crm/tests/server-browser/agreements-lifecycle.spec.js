import { test, expect } from './fixtures.js';
import { login } from '../api/helpers.mjs';
import { command, createAgreement, terms } from '../api/agreements-helpers.mjs';
import { signIn } from './helpers.js';
import { agreementRow, confirmAction, openAgreements, shots } from './agreements-helpers.js';

/**
 * A3b on screen (docs/agreements-a3b.md): company A, which collects the co-broking fee,
 * records a payment to company B; B confirms receipt; both read the certificate; A marks
 * the agreement completed. Set up through the API so the screens are the subject.
 */
test('a recorded payment is confirmed, the certificate opens and the agreement completes', async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(120000);
  const listing = `AG-A3B-${Date.now().toString(36).toUpperCase()}`;
  const [sender, recipient] = [await login('admin-a'), await login('admin-b')];
  const coBroking = terms({
    property: { ...terms().property, listingRef: listing },
    money: { ...terms().money, senderShareBp: 4000, collectingParty: 'sender' },
  });
  const created = await createAgreement(sender, recipient, {
    kind: 'co_broking',
    terms: coBroking,
  });
  expect(created.status, JSON.stringify(created.value)).toBe(201);
  const id = created.value.agreement.id;
  expect((await command(sender, id, 'send', { expectedVersion: 1 })).status).toBe(200);
  expect((await command(recipient, id, 'accept', { expectedVersion: 2 })).status).toBe(200);

  await signIn(page);
  await openAgreements(page);
  await page.getByRole('tab', { name: /Sent/ }).click();
  await agreementRow(page, listing).click();
  const detail = page.getByRole('dialog');
  await expect(detail).toContainText('Payments between companies');
  await expect(detail).toContainText('No money moves through Blaqks One');
  await detail.getByLabel('Amount (AED)').fill('1000');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date());
  await detail.getByLabel('Payment date').fill(today);
  await detail.getByRole('button', { name: 'Record payment', exact: true }).click();
  await expect(detail).toContainText('Payment recorded.');
  await expect(detail).toContainText('Recorded paid');
  await shots(page, testInfo, 'agreement-payments');

  const other = await browser.newContext();
  const pageB = await other.newPage();
  try {
    await signIn(pageB, 'admin-b');
    await openAgreements(pageB);
    await pageB.getByRole('tab', { name: /Incoming/ }).click();
    await agreementRow(pageB, listing).click();
    const detailB = pageB.getByRole('dialog');
    pageB.once('dialog', (prompt) => prompt.accept());
    await detailB
      .getByRole('button', { name: /Confirm receipt/ })
      .first()
      .click();
    await expect(detailB).toContainText('Receipt confirmed.');
    await detailB.getByRole('button', { name: 'Agreement certificate' }).click();
    const certificate = pageB.getByRole('dialog');
    await expect(certificate).toContainText(/Generated/);
    await expect(certificate.locator('.agreement-digest').first()).toHaveText(/^[0-9a-f]{64}$/);
    await expect(certificate.getByRole('button', { name: 'Download evidence JSON' })).toBeEnabled();
    await shots(pageB, testInfo, 'agreement-certificate');
  } finally {
    await other.close();
  }

  // B's confirmation moved the agreement on; A reopens it before acting (optimistic versions).
  await page.getByRole('button', { name: 'Close agreement' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Agreements' })).toBeVisible();
  await page.getByRole('tab', { name: /Sent/ }).click();
  await agreementRow(page, listing).click();
  await expect(detail).toContainText('Receipt confirmed');
  await confirmAction(page, 'Mark completed', 'Mark completed', 'Completed');
  await expect(detail).toContainText('Agreement marked completed.');
});
