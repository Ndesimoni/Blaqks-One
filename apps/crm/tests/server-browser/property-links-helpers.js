import { expect } from '@playwright/test';
import { workspaceRecords } from './assign-helpers.js';

export const MAP = 'https://www.google.com/maps/search/?api=1&query=Marina+Gate+2';

export const contact = (contact_id, full_name, contact_type, building_project, phone) => ({
  contact_id,
  full_name,
  contact_type,
  building_project,
  phone,
});

/**
 * A details link that opens externally in an opener-free tab. With `follow`, the click is
 * intercepted and the popup's URL and `window.opener` are checked.
 */
export async function expectSafeLink(page, details, name, href, follow = false) {
  const link = details.getByRole('link', { name, exact: true });
  await expect(link).toHaveAttribute('href', href);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  if (!follow) return;
  await page
    .context()
    .route(href, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>Map</title>' }),
    );
  const [tab] = await Promise.all([page.waitForEvent('popup'), link.click()]);
  await tab.waitForLoadState();
  expect(tab.url()).toBe(href);
  expect(await tab.evaluate(() => window.opener)).toBeNull();
  await tab.close();
}

/** Creates a property (or PATCHes `legacyId`) as the signed-in page through the record API. */
export async function propertyPost(page, record, legacyId) {
  const { identity, path, body } = await workspaceRecords(page);
  const headers = { Origin: 'http://localhost:5175', 'X-CSRF-Token': identity.csrfToken };
  if (!legacyId) return page.request.post(`${path}/Properties`, { headers, data: { record } });
  const entry = body.records.Properties.find((row) => row.record.property_id === legacyId);
  return page.request.patch(`${path}/Properties/${entry.id}`, {
    headers,
    data: { version: entry.version, record: { ...entry.record, ...record } },
  });
}

/** Legacy IDs of a collection in the signed-in page's `/records` payload. */
export async function visibleIds(page, collection, key) {
  const { body } = await workspaceRecords(page);
  return {
    body,
    ids: (body.records[collection] || []).map((row) => row.record[key]).sort(),
  };
}

/** The open property's details dialog, opened from its card on the Properties page. */
export async function openProperty(page, title) {
  await page.goto('/#/properties');
  const card = page.getByRole('button', { name: new RegExp(title) });
  await card.click();
  const details = page.getByRole('dialog');
  await expect(details.locator('h2')).toHaveText(title);
  return { card, details };
}
