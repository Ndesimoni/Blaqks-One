import { test, expect } from './fixtures.js';
import { assignTeam, held } from './assign-fixtures.js';
import { memberPage, noPageOverflow, setTheme } from './assign-helpers.js';
import { contact, MAP } from './property-links-helpers.js';

const TITLE = 'Layout tower residence with an unusually long listing title';
const BUILDING = 'Emaar Beachfront Grand Bleu Tower 2';
const SHOTS = process.env.PROPERTY_LINKS_SHOTS;
const SIZES = [
  [390, 844],
  [1280, 900],
];

/** Every focusable element of the open dialog, after `count` Tab presses, stays inside it. */
async function tabUntil(page, selector, count = 60) {
  for (let step = 0; step < count; step++) {
    await page.keyboard.press('Tab');
    const state = await page.evaluate(
      (wanted) => ({
        inside: Boolean(document.activeElement?.closest('dialog[open]')),
        hit: document.activeElement?.matches(wanted),
      }),
      selector,
    );
    expect(state.inside).toBe(true);
    if (state.hit) return;
  }
  throw Error(`${selector} was not reached by Tab`);
}

/** Related rows and phone links fit the drawer, meet 44px targets and do not overflow it. */
async function fits(page, region) {
  await region.scrollIntoViewIfNeeded();
  await noPageOverflow(page);
  const drawer = page.getByRole('dialog').locator('.drawer');
  expect(await drawer.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  const box = await drawer.boundingBox();
  for (const target of await region.locator('.related-record-open, .related-record-phone').all()) {
    const rect = await target.boundingBox();
    expect(rect.height).toBeGreaterThanOrEqual(44);
    expect(rect.x).toBeGreaterThanOrEqual(box.x);
    expect(rect.x + rect.width).toBeLessThanOrEqual(box.x + box.width + 1);
  }
}

test('related records are keyboard-operable and reflow at 390 and 1280 in both themes', async ({
  browser,
}, testInfo) => {
  test.setTimeout(120000);
  const team = await assignTeam('pllay');
  for (const row of [
    contact('CT-LY-OWN', 'Layout Owner Alexandra Konstantinopoulou', 'Landlord', BUILDING, ''),
    contact('CT-LY-G', 'Layout Guard Mohammed', 'Security guard', BUILDING, '+971 50 222 0001'),
    contact('CT-LY-M', 'Layout Manager Priya', 'Building manager', BUILDING, '+971 4 222 0002'),
    contact('CT-LY-B', 'Layout Broker With Long Name', 'Broker', BUILDING, ''),
  ])
    await held(team, 'Contacts', row);
  const listing = {
    building_project: BUILDING,
    community: 'Emaar Beachfront',
    listing_status: 'Available',
    property_type: 'Apartment',
  };
  await held(team, 'Properties', {
    property_id: 'PR-LY-1',
    listing_title: TITLE,
    contact_id: 'CT-LY-OWN',
    unit_reference: 'GB2-3104',
    address: 'Unit 3104, Grand Bleu Tower 2, Emaar Beachfront, Dubai Harbour',
    map_link: MAP,
    ...listing,
  });
  await held(team, 'Properties', {
    property_id: 'PR-LY-2',
    listing_title: 'Layout next door',
    ...listing,
  });
  const { page, context } = await memberPage(browser, team.people.admin.email);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  try {
    await page.goto('/#/properties');
    const card = page.getByRole('button', { name: new RegExp(TITLE) });
    await card.focus();
    await page.keyboard.press('Enter');
    const details = page.getByRole('dialog');
    await expect(details.locator('h2')).toHaveText(TITLE);
    await tabUntil(page, '.related-record-open');
    await expect(page.locator(':focus')).toContainText('Layout Guard Mohammed');
    await page.keyboard.press('Enter');
    await expect(details.locator('h2')).toHaveText('Layout Guard Mohammed');
    await expect(page.getByRole('dialog')).toHaveCount(1);
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(
      true,
    );
    await tabUntil(page, '.related-record-open');
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(
      true,
    );
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(card).toBeFocused();

    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await setTheme(page, theme);
      for (const [width, height] of SIZES) {
        await page.setViewportSize({ width, height });
        await card.click();
        await expect(details.locator('h2')).toHaveText(TITLE);
        const building = details.getByRole('region', { name: 'Building contacts', exact: true });
        await expect(building.locator('.related-record')).toHaveCount(3);
        await fits(page, building);
        const name = `property-${width}-${theme}.png`;
        await page.screenshot({ path: SHOTS ? `${SHOTS}/${name}` : testInfo.outputPath(name) });
        await details.getByRole('button', { name: /^Layout Owner .* · Landlord$/ }).click();
        await expect(details.locator('h2')).toHaveText(/Layout Owner/);
        const linked = details.getByRole('region', { name: 'Linked properties', exact: true });
        await expect(linked.locator('.related-record')).toHaveCount(1);
        await fits(page, linked);
        await fits(page, details.getByRole('region', { name: 'Properties in this building' }));
        await linked.scrollIntoViewIfNeeded();
        const shot = `contact-${width}-${theme}.png`;
        await page.screenshot({ path: SHOTS ? `${SHOTS}/${shot}` : testInfo.outputPath(shot) });
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
      }
    }
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
