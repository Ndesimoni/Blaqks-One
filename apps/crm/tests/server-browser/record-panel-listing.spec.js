import { test, expect } from './fixtures.js';
import { assignTeam, held } from './assign-fixtures.js';
import { memberPage, noPageOverflow } from './assign-helpers.js';
import { openPage } from './product-nav.js';

const TITLE = 'Panel listing Marina Gate';

/** A listing with its owner and one viewing, beside another listing's viewing. */
async function listingTeam(prefix) {
  const team = await assignTeam(prefix);
  await held(team, 'Contacts', {
    contact_id: 'CT-RPL-1',
    full_name: 'Synthetic panel owner',
    phone: '+971500000202',
  });
  await held(team, 'Clients', { client_id: 'CL-RPL-1', full_name: 'Synthetic panel tenant' });
  await held(team, 'Properties', {
    property_id: 'PR-RPL-1',
    listing_title: TITLE,
    contact_id: 'CT-RPL-1',
    sale_rental: 'Rental',
    emirate: 'Dubai',
    community: 'Dubai Marina',
    building_project: 'Marina Gate 2',
    unit_reference: '2304',
    property_type: 'Apartment',
    bedrooms: '2',
    area_sq_ft: '1240',
    price_annual_rent_aed: '190000',
    listing_status: 'Available',
    viewing_instructions: 'Keys at reception',
  });
  await held(team, 'Properties', { property_id: 'PR-RPL-2', listing_title: 'Panel listing two' });
  const viewing = (viewing_id, property_id) =>
    held(team, 'Viewings', {
      viewing_id,
      client_id: 'CL-RPL-1',
      property_id,
      appointment_date_time: '2026-11-05 17:00',
      viewing_status: 'Scheduled',
    });
  await viewing('VW-RPL-1', 'PR-RPL-1');
  await viewing('VW-RPL-2', 'PR-RPL-2');
  return team;
}

/** Opens the listing from a card or a list row, whichever the page shows. */
async function openListing(page) {
  await page
    .getByRole('button', { name: new RegExp(TITLE) })
    .first()
    .click();
  const dialog = page.getByRole('dialog', { name: TITLE, exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('a listing opens with the mockup header, facts, private box and its own activity', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const team = await listingTeam('rplisting');
  const { page, context } = await memberPage(browser, team.people.admin.email);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.setViewportSize({ width: 1280, height: 860 });
    await openPage(page, 'Properties');
    for (const [width, height] of [
      [1280, 860],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      const panel = await openListing(page);
      const head = panel.locator('.record-panel-head');
      await expect(head.locator('.record-panel-status')).toContainText('Website: Not published');
      await expect(panel.locator('.property-summary-facts')).toContainText('2 bed · 1,240 sq ft');
      const kept = panel.locator('.property-private-box');
      await expect(kept).toContainText('Owner: Synthetic panel owner · +971 50 *** 0202');
      await expect(kept).not.toContainText('500000202');
      await expect(kept).toContainText('Marina Gate 2 · Unit 2304');
      await expect(kept).toContainText('Keys at reception');
      const activity = panel.getByRole('region', { name: 'Activity', exact: true });
      await expect(activity.getByRole('listitem')).toHaveCount(1);
      await expect(activity).toContainText('Synthetic panel tenant');
      // Share asks which way first; Escape closes only that choice.
      const share = head.getByRole('button', { name: 'Share', exact: true });
      await share.click();
      await expect(
        head.getByRole('button', { name: 'Another company', exact: true }),
      ).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(head.getByRole('button', { name: 'A colleague', exact: true })).toHaveCount(0);
      await expect(share).toBeFocused();
      await expect(panel).toBeVisible();
      await noPageOverflow(page);
      await page.keyboard.press('Escape');
      await expect(panel).toHaveCount(0);
    }

    // The header's commands open the sections' own dialogs over the slider.
    await page.setViewportSize({ width: 1280, height: 860 });
    const panel = await openListing(page);
    const head = panel.locator('.record-panel-head');
    await head.getByRole('button', { name: 'Share', exact: true }).click();
    await head.getByRole('button', { name: 'A colleague', exact: true }).click();
    const colleague = page.getByRole('dialog', { name: 'Share with a colleague', exact: true });
    await expect(colleague).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(colleague).toHaveCount(0);
    await head.getByRole('button', { name: 'Publish on website', exact: true }).click();
    const publish = page.getByRole('dialog', { name: 'Publish on the website', exact: true });
    await expect(publish).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(publish).toHaveCount(0);
    await expect(panel).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
