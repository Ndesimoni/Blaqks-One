import { test, expect } from './fixtures.js';
import { financeDealTeam, memberPage, openDeal, openDeals } from './finance-deals-fixtures.js';
import { patch } from '../api/assignment-helpers.mjs';
import { richDeal } from '../api/finance-handover-fixtures.mjs';
import { accept, offered } from '../api/finance-handover-helpers.mjs';
import { readFileSync } from 'node:fs';
import { upload } from '../api/media-helpers.mjs';

// H3b (owner 2026-10-23): once a hand-over is accepted, the receiver's deal shows the
// client's phone and email and the listing with its photos, read from their own records.
test('the receiver of a hand-over sees the client and the listing on the deal', async ({
  browser,
}) => {
  const team = await financeDealTeam('deal-parties');
  const { deal, property } = await richDeal(team.agent);
  const bytes = readFileSync(new URL('../fixtures/property-photo.jpg', import.meta.url));
  const photo = (await upload(team.agent, bytes, 'front.jpg')).value.media.id;
  const withPhoto = await patch(team.agent, 'Properties', property, {
    ...property.record,
    media_photos: [{ name: 'front.jpg', type: 'image/jpeg', file: photo }],
  });
  expect(withPhoto.status, JSON.stringify(withPhoto.value)).toBe(200);
  const handover = await offered(team.admin, team.agent, deal, team.second);
  expect((await accept(team.second, team.admin, handover)).status).toBe(200);

  const receiver = await memberPage(browser, team.people.second.email);
  try {
    const { page } = receiver;
    await openDeals(page);
    const details = await openDeal(page, deal.dealId);
    const parties = details.getByRole('region', { name: 'Client and listing' });
    await expect(parties).toContainText('Synthetic Zqxbuyer');
    await expect(parties.getByRole('link', { name: '+971500000302' })).toHaveAttribute(
      'href',
      'tel:+971500000302',
    );
    await expect(parties.getByRole('link', { name: 'zqx.buyer@example.test' })).toBeVisible();
    await expect(parties).toContainText('Synthetic Marina View');
    await expect(parties).toContainText('Dubai Marina · 2 BR');
    const image = parties.getByRole('img', { name: /^Photo 1 of Synthetic Marina View$/ });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((node) => node.naturalWidth)).toBeGreaterThan(0);
    await expect(parties).not.toContainText('Zqx client private note');
    await parties.getByRole('button', { name: /^Open client / }).click();
    const client = page.getByRole('dialog', { name: /Synthetic Zqxbuyer/ });
    await expect(client).toContainText('zqx.buyer@example.test');
    await page.keyboard.press('Escape');
    await details.getByRole('button', { name: 'Close deal details' }).click();

    // The hand-over's agreement shows the same client and listing.
    await page.goto('/#/agreements');
    await page
      .getByRole('button', { name: /In-company/ })
      .first()
      .click();
    const agreement = page.getByRole('dialog');
    const shown = agreement.getByRole('region', { name: 'Client and listing' });
    await expect(shown.getByRole('link', { name: 'zqx.buyer@example.test' })).toBeVisible();
    await expect(shown).toContainText('Synthetic Marina View');
    await expect(shown.getByRole('button', { name: /^Open listing / })).toBeVisible();
  } finally {
    await receiver.context.close();
  }
});
