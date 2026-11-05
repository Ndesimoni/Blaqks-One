import { test, expect } from './fixtures.js';
import { assignTeam, held } from './assign-fixtures.js';
import { memberPage } from './assign-helpers.js';
import { openProperty } from './property-links-helpers.js';

// Record sharing R2a (docs/record-sharing.md R2): a listing shared with an agent at another
// company, view only, until a chosen day; the owner's details never travel.
const title = 'Synthetic Outside Penthouse';
const listing = {
  listing_title: title,
  community: 'Dubai Marina',
  emirate: 'Dubai',
  bedrooms: '3',
  property_description: 'Sea views from every room',
  unit_reference: 'R2A-UNIT-7',
  notes: 'Owner-only synthetic note',
};
const label = new RegExp(`^${title} · Dubai Marina$`);

async function shareOutside(page, agentEmail) {
  const { details } = await openProperty(page, title);
  const outside = details.getByRole('region', { name: 'Other companies', exact: true });
  await expect(outside).toContainText('Not shared outside your company');
  await outside.getByRole('button', { name: 'Share with another company', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Share with an agent at another company' });
  await dialog.getByLabel(/Recipient’s email/).fill(agentEmail);
  await dialog.getByRole('button', { name: 'Find', exact: true }).click();
  await expect(dialog).toContainText('Synthetic outside-r2a-other');
  await dialog.getByRole('button', { name: 'Review', exact: true }).click();
  const review = page.getByRole('dialog', { name: /^Review what/ });
  await expect(review).toContainText('Before they accept');
  for (const secret of [listing.notes, listing.unit_reference])
    await expect(review).not.toContainText(secret);
  await review.getByRole('button', { name: 'Send', exact: true }).click();
  const sent = page.getByRole('dialog', { name: /^Shared with / });
  const link = await sent.getByLabel('Link', { exact: true }).inputValue();
  expect(link).toMatch(/\/#\/listing-shares\/[0-9a-f-]{36}$/);
  const href = await sent.getByRole('link', { name: 'Share on WhatsApp' }).getAttribute('href');
  const text = decodeURIComponent(href.slice('https://wa.me/?text='.length));
  expect(text).toContain('shared a property with you in Blaqks One');
  for (const secret of [title, 'Dubai Marina', 'AED']) expect(text).not.toContain(secret);
  await sent.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(outside).toContainText('Shared with 1 agent at another company');
  return link.slice(link.indexOf('/#'));
}

test('a holder shares a listing with another company; the agent accepts and sees it, then it is stopped', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const team = await assignTeam('outside-r2a');
  const { one, two } = team.people;
  await held(team, 'Properties', listing, one.id);
  const agentEmail = 'outside-r2a-other@team-fixture.test';
  const holder = await memberPage(browser, one.email);
  const agent = await memberPage(browser, agentEmail);
  const colleague = await memberPage(browser, two.email);
  try {
    const path = await shareOutside(holder.page, agentEmail);

    // Someone else in the sender's company gets the plain refusal.
    await colleague.page.goto(path);
    await expect(colleague.page.getByRole('dialog').getByRole('alert')).toHaveText(
      'This shared listing isn’t available.',
    );

    const { page } = agent;
    await page.goto(path);
    const offer = page.getByRole('dialog', { name: label });
    await expect(offer).toContainText('Waiting for an answer');
    await expect(offer).not.toContainText(listing.property_description);
    await offer.getByRole('button', { name: 'Accept', exact: true }).click();
    const confirm = page.getByRole('dialog', { name: 'Accept this listing?' });
    await expect(confirm).toContainText('introduced this listing to you');
    await confirm.getByRole('button', { name: 'Accept', exact: true }).click();
    const open = page.getByRole('dialog', { name: label });
    await expect(open).toContainText('Accepted. You can now see the listing and its photos.');
    await expect(open).toContainText(listing.property_description);
    await expect(open).toContainText('View only');
    for (const secret of [listing.notes, listing.unit_reference])
      await expect(open).not.toContainText(secret);
    await open.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Agreements' })).toBeVisible();
    await page.getByRole('tab', { name: 'Listings', exact: true }).click();
    const incoming = page.getByRole('list', { name: 'Shared with you' });
    await expect(incoming).toContainText(title);
    await expect(incoming).toContainText('Accepted');

    // The holder stops sharing from the listing's details.
    await holder.page.reload();
    const { details } = await openProperty(holder.page, title);
    const outside = details.getByRole('region', { name: 'Other companies', exact: true });
    await outside.getByRole('button', { name: /^Open share LS-/ }).click();
    const share = holder.page.getByRole('dialog', { name: label });
    await share.getByRole('button', { name: 'Stop sharing', exact: true }).click();
    await holder.page
      .getByRole('dialog', { name: 'Stop sharing?' })
      .getByRole('button', { name: 'Stop sharing', exact: true })
      .click();
    await expect(share).toContainText('Stopped sharing.');

    await page.reload();
    await page.getByRole('tab', { name: 'Listings', exact: true }).click();
    await page.getByRole('list', { name: 'Shared with you' }).getByRole('button').first().click();
    const closed = page.getByRole('dialog', { name: label });
    await expect(closed).toContainText('This listing is no longer available.');
    await expect(closed).not.toContainText(listing.property_description);
  } finally {
    await Promise.all([holder, agent, colleague].map((member) => member.context.close()));
  }
});
