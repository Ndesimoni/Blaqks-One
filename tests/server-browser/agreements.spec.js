import { test, expect } from './fixtures.js';
import { login } from '../api/helpers.mjs';
import { activate, invite } from '../api/team-helpers.mjs';
import { command, createAgreement, terms } from '../api/agreements-helpers.mjs';
import { newCompany } from '../api/company-helpers.mjs';
import { signIn } from './helpers.js';
import { memberPage, noPageOverflow } from './assign-helpers.js';
import {
  agreementRow,
  confirmAction,
  draftCoBroking,
  openAgreements,
  shots,
} from './agreements-helpers.js';

/** A staff member of company B, the recipient of company A's offers. */
async function companyBMember(suffix) {
  const invited = await invite(await login('admin-b'), suffix);
  const session = await activate(invited);
  return { ...session, email: invited.email, name: `Synthetic ${suffix}` };
}

test('company A sends a co-broking offer that a member of company B accepts', async ({
  page,
  browser,
}, testInfo) => {
  const stamp = Date.now();
  const member = await companyBMember(`agreement-b-${stamp}`);
  const outsider = (await newCompany(`agreement-c-${stamp}`)).admin;
  const listing = `AG-UI-${stamp.toString(36).toUpperCase()}`;
  await signIn(page);
  await page
    .getByRole('navigation', { name: 'CRM sections' })
    .getByRole('button', { name: 'Agreements', exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Agreements' })).toBeVisible();
  await draftCoBroking(page, {
    email: member.email,
    recipientName: member.name,
    listing,
    share: 40,
    onReview: () => shots(page, testInfo, 'agreement-form-review'),
  });
  await confirmAction(page, 'Send offer', 'Send offer', 'Sent');
  await expect(page.getByRole('dialog').getByRole('status').first()).toContainText('Offer sent');
  await expect(page.getByRole('dialog')).toContainText(
    /Evidence digest \(SHA-256\)[\s\S]*[0-9a-f]{64}/,
  );
  await page.getByRole('button', { name: 'Close agreement' }).click();
  await page.getByRole('tab', { name: /Sent/ }).click();
  await expect(agreementRow(page, listing)).toContainText(`To ${member.name}`);
  await expect(agreementRow(page, listing)).toContainText('40%');
  await shots(page, testInfo, 'agreements-list');

  const other = await memberPage(browser, member.email);
  await openAgreements(other.page);
  await other.page.getByRole('tab', { name: /Incoming/ }).click();
  const incoming = agreementRow(other.page, listing);
  await expect(incoming).toContainText('From Fixture Admin A');
  await expect(incoming).toContainText('Your answer is needed');
  await expect(incoming).toContainText('60%');
  await incoming.click();
  await expect(other.page.getByRole('dialog')).toContainText('Synthetic K.');
  await shots(other.page, testInfo, 'agreement-incoming');
  await confirmAction(other.page, 'Accept', 'Accept agreement', 'Accepted');
  await expect(other.page.getByRole('dialog').locator('.agreement-evidence')).toContainText(
    `By ${member.name}`,
  );
  await other.context.close();

  await page.reload();
  await openAgreements(page);
  await expect(agreementRow(page, listing)).toContainText('Accepted');
  await agreementRow(page, listing).click();
  await expect(page.getByRole('dialog').locator('.agreement-history')).toContainText(
    `${member.name} accepted`,
  );
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Accept' })).toHaveCount(0);

  // A third company never sees the agreement.
  const third = await memberPage(browser, outsider.email);
  await openAgreements(third.page);
  await expect(third.page.getByText('No agreements yet')).toBeVisible();
  await expect(agreementRow(third.page, listing)).toHaveCount(0);
  await third.context.close();
});

test('a counter-offer becomes a new revision that the sender accepts', async ({
  page,
  browser,
}, testInfo) => {
  const stamp = Date.now();
  const member = await companyBMember(`agreement-counter-${stamp}`);
  const sender = await login('admin-a');
  const listing = `AG-CO-${stamp.toString(36).toUpperCase()}`;
  const property = { ...terms().property, listingRef: listing };
  const created = await createAgreement(sender, member, {
    kind: 'handover_referral',
    terms: terms({ property, money: { ...terms().money, senderShareBp: 2500 } }),
  });
  expect(created.status).toBe(201);
  const id = created.value.agreement.id;
  expect((await command(sender, id, 'send', { expectedVersion: 1 })).status).toBe(200);

  const other = await memberPage(browser, member.email);
  await openAgreements(other.page);
  await agreementRow(other.page, listing).click();
  const dialog = other.page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Counter-offer' }).click();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByLabel(/Referral share kept/).fill('15');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.locator('.agreement-review')).toContainText('15%');
  await dialog.getByRole('button', { name: 'Send counter-offer' }).click();
  await expect(dialog.locator('.agreement-status')).toContainText('Counter-offer');
  await expect(dialog.locator('.agreement-status')).toContainText('Waiting for their answer');
  await expect(dialog.getByRole('group', { name: 'Revisions' }).getByRole('button')).toHaveCount(2);
  await other.page.setViewportSize({ width: 390, height: 900 });
  await noPageOverflow(other.page);
  await other.context.close();

  await signIn(page);
  await openAgreements(page);
  await agreementRow(page, listing).click();
  const detail = page.getByRole('dialog');
  await expect(detail.locator('.agreement-status')).toContainText('Your answer is needed');
  await expect(detail.locator('.agreement-terms')).toContainText('15%');
  await detail.getByRole('button', { name: /Revision 1/ }).click();
  await expect(detail.locator('.agreement-terms')).toContainText('25%');
  await shots(page, testInfo, 'agreement-counter');
  await confirmAction(page, 'Accept', 'Accept agreement', 'Accepted');
  await expect(detail.locator('.agreement-history')).toContainText('Fixture Admin A accepted');
});
