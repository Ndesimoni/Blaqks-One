import { expect, test } from './helpers/session.js';

const map = 'https://maps.google.com/?q=Marina%20Gate%202';
const contact = (contact_id, full_name, contact_type, building_project, phone) => ({
  contact_id,
  full_name,
  contact_type,
  building_project,
  phone,
});
const seed = {
  Contacts: [
    contact('CT-L1', 'Rana Haddad', 'Landlord', 'Marina Gate 2', '+971 50 000 0101'),
    contact('CT-B1', 'Zaid Broker', 'Broker', 'marina gate 2', ''),
    contact('CT-M1', 'Bilal Khan', 'Building manager', ' Marina  Gate 2', '+971 4 000 0102'),
    contact('CT-G1', 'Yusuf Ali', 'Security guard', 'MARINA GATE 2', '+971 50 000 0103'),
    contact('CT-X1', 'Other tower guard', 'Security guard', 'Marina Gate 1', ''),
  ],
  Properties: [
    {
      property_id: 'PR-T1',
      listing_title: 'Marina Gate test apartment',
      contact_id: 'CT-L1',
      building_project: 'Marina Gate 2',
      community: 'Dubai Marina',
      listing_status: 'Available',
      property_type: 'Apartment',
      unit_reference: 'MG2-1204',
      address: 'Unit 1204, Marina Gate Tower 2',
      map_link: map,
      listing_url: 'https://example.com/listing/pr-t1',
      photos_documents_url: 'https://example.com/photos/pr-t1',
    },
    {
      property_id: 'PR-T2',
      listing_title: 'Unlinked test villa',
      contact_id: 'CT-404',
      listing_url: 'javascript:alert(1)',
      photos_documents_url: 'example.com/photos',
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((data) => {
    if (!localStorage.getItem('kws-crm-v1:workspace:aidah'))
      localStorage.setItem('kws-crm-v1:workspace:aidah', JSON.stringify({ data, demo: false }));
  }, seed);
});

const openProperty = async (page, title) => {
  await page.goto('/#/properties');
  await page.locator('.modern-property-card', { hasText: title }).click();
  const details = page.getByRole('dialog');
  await expect(details.locator('h2')).toHaveText(title);
  return details;
};

test('property details link the map, listing, contact and building contacts', async ({ page }) => {
  const details = await openProperty(page, 'Marina Gate test apartment');
  const labels = await details.locator('.detail-field > span').allTextContents();
  const at = labels.indexOf('Unit reference');
  expect(labels.slice(at, at + 3)).toEqual(['Unit reference', 'Address', 'Map link']);
  await expect(details).toContainText('Unit 1204, Marina Gate Tower 2');
  for (const [name, href] of [
    ['Open map', map],
    ['Open listing', 'https://example.com/listing/pr-t1'],
    ['Open photos & documents', 'https://example.com/photos/pr-t1'],
  ]) {
    const link = details.getByRole('link', { name, exact: true });
    await expect(link).toHaveAttribute('href', href);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  const building = details.getByRole('region', { name: 'Building contacts', exact: true });
  await expect(building).toContainText('Marina Gate 2');
  const rows = building.locator('.related-record');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Yusuf Ali');
  await expect(rows.nth(0)).toContainText('Security guard');
  await expect(rows.nth(1)).toContainText('Bilal Khan');
  await expect(rows.nth(2)).toContainText('Zaid Broker');
  await expect(building).not.toContainText(/Rana Haddad|Other tower guard/);
  const phone = rows.nth(1).getByRole('link', { name: '+971 4 000 0102', exact: true });
  await expect(phone).toHaveAttribute('href', 'tel:+97140000102');
  await expect(rows.nth(2).getByRole('link')).toHaveCount(0);
  await rows.nth(1).getByRole('button').click();
  await expect(details.locator('h2')).toHaveText('Bilal Khan');
  await expect(details).toContainText('Building manager');
  await page.keyboard.press('Escape');
  await expect(details).toHaveCount(0);

  const reopened = await openProperty(page, 'Marina Gate test apartment');
  const linked = reopened.getByRole('button', { name: 'Rana Haddad · Landlord', exact: true });
  await linked.focus();
  await page.keyboard.press('Enter');
  await expect(reopened.locator('h2')).toHaveText('Rana Haddad');
  const properties = reopened.getByRole('region', { name: 'Linked properties', exact: true });
  await expect(properties.locator('.related-record')).toHaveCount(1);
  await expect(properties).toContainText('PR-T1 · Marina Gate 2 · Dubai Marina · Available');
  await expect(reopened.getByRole('region', { name: 'Properties in this building' })).toHaveCount(
    0,
  );
  await properties.getByRole('button', { name: /Marina Gate test apartment/ }).click();
  await expect(reopened.locator('h2')).toHaveText('Marina Gate test apartment');
  await expect(reopened.locator('h2')).toBeFocused();
});

test('contacts in a property building list it under Properties in this building', async ({
  page,
}) => {
  await page.goto('/#/contacts');
  await page.getByRole('button', { name: 'Open record CT-G1', exact: true }).click();
  const details = page.getByRole('dialog');
  await expect(details.getByRole('region', { name: 'Linked properties' })).toHaveCount(0);
  const nearby = details.getByRole('region', { name: 'Properties in this building', exact: true });
  await expect(nearby.locator('.related-record')).toHaveCount(1);
  await nearby.getByRole('button', { name: /Marina Gate test apartment/ }).click();
  await expect(details.locator('h2')).toHaveText('Marina Gate test apartment');
});

test('missing contacts and unsafe property links stay plain text', async ({ page }) => {
  const details = await openProperty(page, 'Unlinked test villa');
  await expect(details).toContainText('CT-404 · Linked record unavailable');
  await expect(details).toContainText('javascript:alert(1)');
  await expect(details).toContainText('example.com/photos');
  await expect(details.locator('.details-grid').getByRole('link')).toHaveCount(0);
  await expect(details.locator('.details-grid').getByRole('button')).toHaveCount(0);
  await expect(details.getByRole('region', { name: 'Building contacts' })).toHaveCount(0);
});
