import { test, expect } from './fixtures.js';
import { assignTeam } from './assign-fixtures.js';
import { session } from './helpers.js';
import {
  assignInBrowser,
  memberPage,
  openRecord,
  saveRecordForm,
  workspaceRecords,
} from './assign-helpers.js';

const address = 'Tower 2 lobby, Marina Gate, Marina Walk';
const mapLink = 'https://www.google.com/maps/search/?api=1&query=Marina+Gate+2';
const serverMessage = 'Enter a complete http:// or https:// map link.';

/** The details link opens the saved map in a separate, opener-free tab. */
async function expectOpenMap(page, details) {
  const open = details.getByRole('link', { name: 'Open map', exact: true });
  await expect(open).toHaveAttribute('href', mapLink);
  await expect(open).toHaveAttribute('target', '_blank');
  await expect(open).toHaveAttribute('rel', 'noopener noreferrer');
  await page
    .context()
    .route('https://www.google.com/maps/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>Map</title>' }),
    );
  const [tab] = await Promise.all([page.waitForEvent('popup'), open.click()]);
  await tab.waitForLoadState();
  expect(tab.url()).toBe(mapLink);
  expect(await tab.evaluate(() => window.opener)).toBeNull();
  await tab.close();
}

test('an Admin saves a contact address and map link that survive reload, search and staff hand-off', async ({
  browser,
}) => {
  const team = await assignTeam('ctaddr');
  const admin = await memberPage(browser, team.people.admin.email);
  const { page } = admin;
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const rows = page.locator('.data-table tbody tr');
  const contacts = async () => (await workspaceRecords(page)).body.records.Contacts;
  try {
    await page.goto('/#/contacts');
    await page.getByRole('button', { name: 'Add contact', exact: true }).click();
    const form = page.getByRole('dialog');
    await form.getByLabel('Contact ID', { exact: true }).fill('CT-ADDR-1');
    await form.getByLabel('Full name', { exact: true }).fill('Addr manager');
    await form.getByLabel('Contact type', { exact: true }).selectOption('Building manager');
    await form.getByLabel('Address', { exact: true }).fill(address);
    const map = form.getByLabel('Map link', { exact: true });
    await expect(map).toHaveAttribute('type', 'url');
    await map.fill('maps.google.com/?q=Marina+Gate');
    await saveRecordForm(page);
    await expect(form.locator('#map_link-error')).toHaveText(
      'Enter a complete http:// or https:// URL.',
    );
    await expect(map).toBeFocused();
    await expect(form).toBeVisible();
    expect((await contacts()).some((row) => row.record.contact_id === 'CT-ADDR-1')).toBe(false);
    await map.fill(mapLink);
    await saveRecordForm(page);
    await expect(form).toHaveCount(0);
    const saved = (await contacts()).find((row) => row.record.contact_id === 'CT-ADDR-1');
    expect(saved.record).toMatchObject({ address, map_link: mapLink });

    await page.reload();
    const search = page.getByRole('textbox', { name: 'Search Contacts', exact: true });
    for (const query of ['tower 2 lobby', 'MARINA WALK']) {
      await search.fill(query);
      await expect(rows).toHaveCount(1);
      await expect(rows).toContainText('CT-ADDR-1');
    }
    await search.fill('');
    const details = await openRecord(page, 'CT-ADDR-1');
    await expect(details.locator('.detail-field strong', { hasText: address })).toBeVisible();
    await expectOpenMap(page, details);

    const identity = await session(page);
    const before = (await contacts()).length;
    const rejected = await page.request.post(
      `/api/crm/workspaces/${identity.user.workspaceId || identity.user.id}/records/Contacts`,
      {
        headers: { Origin: 'http://localhost:5175', 'X-CSRF-Token': identity.csrfToken },
        data: {
          record: { contact_id: 'CT-ADDR-JS', full_name: 'Bad', map_link: 'javascript:alert(1)' },
        },
      },
    );
    expect(rejected.status()).toBe(400);
    expect((await rejected.json()).message).toBe(serverMessage);
    const after = await contacts();
    expect(after).toHaveLength(before);
    expect(after.some((row) => row.record.contact_id === 'CT-ADDR-JS')).toBe(false);

    await assignInBrowser(page, 'Contacts', 'contact_id', 'CT-ADDR-1', team.people.one.id);
    expect(errors).toEqual([]);
  } finally {
    await admin.context.close();
  }
  const staff = await memberPage(browser, team.people.one.email);
  try {
    await staff.page.goto('/#/contacts');
    const view = await openRecord(staff.page, 'CT-ADDR-1');
    await expect(view.locator('.detail-field strong', { hasText: address })).toBeVisible();
    await expectOpenMap(staff.page, view);
  } finally {
    await staff.context.close();
  }
});
