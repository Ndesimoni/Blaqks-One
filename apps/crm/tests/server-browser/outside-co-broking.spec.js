import { test, expect } from './fixtures.js';
import { accepted, listing, outsideTeams } from '../api/outside-sharing-helpers.mjs';
import { memberPage } from './assign-helpers.js';
import { confirmAction, shots } from './agreements-helpers.js';

// Co-broking from a listing share (docs/record-sharing.md R2): the agent proposes it over the
// accepted share with the listing's facts fixed and sends it; the sender opens it from the share.
const title = 'Synthetic Co-broking Villa';
const label = new RegExp(`^${title} · Dubai Hills$`);

test('the agent proposes co-broking on a shared listing and the sender opens the offer', async ({
  browser,
}, testInfo) => {
  test.setTimeout(180000);
  const teams = await outsideTeams('outside-cob');
  const record = await listing(teams, 'one', {
    listing_title: title,
    price_annual_rent_aed: '4200000',
    area_sq_ft: '3100',
  });
  const share = await accepted(teams.one, record, teams.agent);
  const agent = await memberPage(browser, 'outside-cob-agent@team-fixture.test');
  const sender = await memberPage(browser, 'outside-cob-one@team-fixture.test');
  try {
    const { page } = agent;
    await page.goto(`/#/listing-shares/${share.id}`);
    const open = page.getByRole('dialog', { name: label });
    await open.getByRole('button', { name: 'Propose co-broking', exact: true }).click();

    const form = page.getByRole('dialog', { name: 'Propose co-broking' });
    await expect(form).toContainText(share.reference);
    await expect(form).toContainText('Dubai Hills');
    await expect(form.getByLabel('Community or area')).toHaveCount(0);
    await shots(page, testInfo, 'co-broking-subject');
    await form.getByLabel('Client name').fill('Synthetic K.');
    await form.getByRole('button', { name: 'Next' }).click();
    await form.getByLabel('Agreed amount (AED)').fill('84000');
    await form.getByLabel(/Sending side.s share/).fill('50');
    await form.getByLabel('Fee collected by').selectOption('sender');
    await form.getByRole('button', { name: 'Next' }).click();
    await expect(form.locator('.agreement-review')).toContainText(share.reference);
    await shots(page, testInfo, 'co-broking-review');
    await form.getByRole('button', { name: 'Save draft' }).click();

    const draft = page.getByRole('dialog');
    await expect(draft.locator('.agreement-status')).toContainText('Draft');
    await expect(draft).toContainText('Introduction');
    await expect(draft).toContainText(share.reference);
    await confirmAction(page, 'Send offer', 'Send offer', 'Sent');
    await shots(page, testInfo, 'co-broking-sent');
    await draft.getByRole('button', { name: 'Close agreement' }).click();
    await expect(open).toContainText('Co-broking: Offer sent');
    await expect(open.getByRole('button', { name: 'Propose co-broking' })).toHaveCount(0);
    await shots(page, testInfo, 'co-broking-share');

    await sender.page.goto(`/#/listing-shares/${share.id}`);
    const theirs = sender.page.getByRole('dialog', { name: label });
    await expect(theirs).toContainText('Co-broking: Offer sent');
    await theirs.getByRole('button', { name: 'Open co-broking agreement', exact: true }).click();
    const offer = sender.page.getByRole('dialog');
    await expect(offer.locator('.agreement-status')).toContainText('Sent');
    await expect(offer).toContainText('Introduction');
    await expect(offer).toContainText('AED 84,000.00');
  } finally {
    await Promise.all([agent, sender].map((member) => member.context.close()));
  }
});
