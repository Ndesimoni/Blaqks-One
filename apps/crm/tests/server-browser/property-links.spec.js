import { test, expect } from './fixtures.js';
import { assignTeam, held } from './assign-fixtures.js';
import { memberPage, saveRecordForm, workspaceRecords } from './assign-helpers.js';
import { contact, expectSafeLink, MAP, propertyPost } from './property-links-helpers.js';

const LISTING = 'https://example.com/listing/pr-pl-1';
const PHOTOS = 'https://example.com/photos/pr-pl-1';
const ADDRESS = 'Unit 1204, Marina Gate Tower 2, Marina Walk';
const TITLE = 'Links test apartment';

test('an Admin saves property Address, Map link and links that open related records', async ({
  browser,
}) => {
  const team = await assignTeam('plinks');
  for (const row of [
    contact('CT-PL-OWN', 'Lina Owner', 'Landlord', 'Marina Gate 2', '+971 50 000 0100'),
    contact('CT-PL-MGR', 'Bilal Manager', 'Building manager', ' marina  gate 2', '+971 4 000 0102'),
    contact('CT-PL-GRD', 'Yusuf Guard', 'Security guard', 'MARINA GATE 2', '+971 50 000 0103'),
    contact('CT-PL-FAR', 'Far Guard', 'Security guard', 'Marina Gate 1', '+971 50 000 0104'),
  ])
    await held(team, 'Contacts', row);
  await held(team, 'Properties', {
    property_id: 'PR-PL-NEAR',
    listing_title: 'Neighbour unit',
    building_project: 'Marina Gate 2',
  });
  const { page, context } = await memberPage(browser, team.people.admin.email);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto('/#/properties');
    await page.getByRole('button', { name: 'Add property', exact: true }).click();
    const form = page.getByRole('dialog');
    const next = form.getByRole('button', { name: 'Next', exact: true });
    await form.getByLabel('Property ID', { exact: true }).fill('PR-PL-1');
    await form.getByLabel('Listing title', { exact: true }).fill(TITLE);
    await form.getByLabel('Contact ID', { exact: true }).selectOption('CT-PL-OWN');
    await next.click();
    await form.getByLabel('Community', { exact: true }).fill('Dubai Marina');
    await form.getByLabel('Building / project', { exact: true }).fill('Marina Gate 2');
    await form.getByLabel('Unit reference', { exact: true }).fill('MG2-1204');
    await form.getByLabel('Address', { exact: true }).fill(ADDRESS);
    const map = form.getByLabel('Map link', { exact: true });
    await expect(map).toHaveAttribute('type', 'url');
    await map.fill('maps.google.com/?q=Marina+Gate');
    await next.click();
    await expect(form.locator('#map_link-error')).toHaveText(
      'Enter a complete http:// or https:// URL.',
    );
    await expect(map).toBeFocused();
    await expect(form.locator('.form-progress')).toContainText('Step 2 of 6');
    await map.fill(MAP);
    for (let step = 0; step < 3; step++) await next.click();
    await form.getByLabel('Listing URL', { exact: true }).fill(LISTING);
    await form.getByLabel('Photos / documents URL', { exact: true }).fill(PHOTOS);
    const before = (await workspaceRecords(page)).body.records.Properties;
    expect(before.map((row) => row.record.property_id)).toEqual(['PR-PL-NEAR']);
    await saveRecordForm(page);
    await expect(form).toHaveCount(0);
    const saved = (await workspaceRecords(page)).body.records.Properties.find(
      (row) => row.record.property_id === 'PR-PL-1',
    ).record;
    expect(saved).toMatchObject({
      address: ADDRESS,
      map_link: MAP,
      contact_id: 'CT-PL-OWN',
      listing_url: LISTING,
      photos_documents_url: PHOTOS,
    });

    await page.reload();
    const card = page.getByRole('button', { name: new RegExp(TITLE) });
    await card.click();
    const details = page.getByRole('dialog');
    await expect(details.locator('h2')).toHaveText(TITLE);
    const labels = await details.locator('.detail-field > span').allTextContents();
    const at = labels.indexOf('Unit reference');
    expect(labels.slice(at, at + 3)).toEqual(['Unit reference', 'Address', 'Map link']);
    await expect(details.locator('.detail-field strong', { hasText: ADDRESS })).toBeVisible();
    await expectSafeLink(page, details, 'Open listing', LISTING);
    await expectSafeLink(page, details, 'Open photos & documents', PHOTOS);
    await expectSafeLink(page, details, 'Open map', MAP, true);
    const building = details.getByRole('region', { name: 'Building contacts', exact: true });
    await expect(building).toContainText('Marina Gate 2');
    const rows = building.locator('.related-record');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Yusuf GuardSecurity guard');
    await expect(rows.nth(1)).toContainText('Bilal ManagerBuilding manager');
    await expect(building).not.toContainText(/Lina Owner|Far Guard/);
    for (const [index, phone, href] of [
      [0, '+971 50 000 0103', 'tel:+971500000103'],
      [1, '+971 4 000 0102', 'tel:+97140000102'],
    ])
      await expect(rows.nth(index).getByRole('link', { name: phone, exact: true })).toHaveAttribute(
        'href',
        href,
      );
    await rows.nth(1).getByRole('button').click();
    await expect(details.locator('h2')).toHaveText('Bilal Manager');
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(card).toBeFocused();

    await card.click();
    const linked = details.getByRole('button', { name: 'Lina Owner · Landlord', exact: true });
    await linked.focus();
    await page.keyboard.press('Enter');
    await expect(details.locator('h2')).toHaveText('Lina Owner');
    const mine = details.getByRole('region', { name: 'Linked properties', exact: true });
    await expect(mine.locator('.related-record')).toHaveCount(1);
    await expect(mine).toContainText(`${TITLE}PR-PL-1 · Marina Gate 2 · Dubai Marina`);
    const nearby = details.getByRole('region', { name: 'Properties in this building' });
    await expect(nearby.locator('.related-record')).toHaveCount(1);
    await expect(nearby).toContainText('Neighbour unitPR-PL-NEAR');
    await mine.getByRole('button', { name: new RegExp(TITLE) }).click();
    await expect(details.locator('h2')).toHaveText(TITLE);
    await details.getByRole('button', { name: 'Close record details' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(card).toBeFocused();

    const count = (await workspaceRecords(page)).body.records.Properties.length;
    for (const bad of ['javascript:alert(1)', 'not a link']) {
      const refused = await propertyPost(page, { property_id: 'PR-PL-JS', map_link: bad });
      expect(refused.status()).toBe(400);
      expect((await refused.json()).message).toBe('Enter a complete http:// or https:// map link.');
    }
    const patched = await propertyPost(page, { map_link: 'javascript:alert(1)' }, 'PR-PL-1');
    expect(patched.status()).toBe(400);
    const after = (await workspaceRecords(page)).body.records.Properties;
    expect(after).toHaveLength(count);
    expect(after.find((row) => row.record.property_id === 'PR-PL-1').record.map_link).toBe(MAP);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
