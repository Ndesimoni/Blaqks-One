import { setTheme } from './assign-helpers.js';
import { expect, test } from './fixtures.js';
import { addClient, createRecord, saveRecordForm, signIn } from './helpers.js';

const viewports = [
  { width: 1280, height: 800, label: '1280' },
  { width: 390, height: 844, label: '390' },
];

/** Both reviewed directories in both themes at desktop and phone width (UI3 §7, UI4a). */
async function capture(page, testInfo, name) {
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      if (viewport.width < 750) {
        await expect(page.locator('.record-card').first()).toBeVisible();
        await expect(page.locator('.data-table')).toHaveCount(0);
        const top = await page
          .locator('.record-card')
          .first()
          .evaluate((card) => card.getBoundingClientRect().top);
        expect(top, 'first record within 520px').toBeLessThanOrEqual(520);
      } else {
        await expect(page.locator('.data-table tbody tr').first()).toBeVisible();
        await expect(page.locator('.record-card')).toHaveCount(0);
      }
      await page.screenshot({
        path: testInfo.outputPath(`${name}-${viewport.label}-${theme}.png`),
      });
    }
  }
}

/** A cold Vite start can leave the lazy shell on its splash past the helper's default wait. */
async function openSignIn(page) {
  await page.goto('/');
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible({ timeout: 60000 });
}

async function addContact(page, id, name) {
  await createRecord(page, 'Contact');
  const form = page.getByRole('dialog');
  await form.getByLabel('Contact ID', { exact: true }).fill(id);
  await form.getByLabel('Full name', { exact: true }).fill(name);
  await form.getByLabel('Contact type', { exact: true }).selectOption('Landlord');
  await form.getByLabel('Company', { exact: true }).fill('Marina Homes');
  await form.getByLabel('Phone', { exact: true }).fill('+971 50 555 0170');
  await form.getByLabel('Email', { exact: true }).fill('landlord@example.test');
  await saveRecordForm(page);
  await expect(form).toHaveCount(0);
}

test('Leads read as one directory with a compact source filter and one primary action', async ({
  page,
}, testInfo) => {
  test.setTimeout(180000);
  await openSignIn(page);
  await signIn(page, 'admin-a');
  await addClient(page, 'UIA-LEAD-1', 'Pilot lead Alpha');
  await page.goto('/#/leads');

  const leadCount = Number(await page.locator('.record-count-number').innerText());
  await expect(page.locator('.record-count-word')).toHaveText(leadCount === 1 ? 'lead' : 'leads');
  await expect(page.getByText(/^Total leads$/)).toHaveCount(0);
  await expect(
    page.getByRole('banner').getByRole('button', { name: 'Create', exact: true }),
  ).toHaveCount(1);
  const views = page.getByRole('group', { name: 'View', exact: true });
  await expect(views.getByRole('button', { name: 'Kanban', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('region', { name: 'Leads pipeline' })).toBeVisible();
  await page
    .getByRole('button', { name: 'Move Pilot lead Alpha to another stage', exact: true })
    .click();
  await page.getByRole('button', { name: 'Contacted', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Pilot lead Alpha moved to Contacted');
  await expect(
    page
      .locator('.kanban-column')
      .filter({ hasText: /^Contacted/ })
      .getByText('Pilot lead Alpha'),
  ).toBeVisible();

  // The mockup's presets lead the filter row; Source (with counts) and Lead stage stay as pills.
  const presets = page.getByRole('group', { name: 'Filter leads', exact: true });
  for (const name of ['New this week', 'Hot', 'From the website'])
    await expect(presets.getByRole('button', { name, exact: true })).toBeVisible();
  const clear = page.getByRole('button', { name: 'Clear filters', exact: true });
  await expect(clear).toHaveCount(0);
  const source = page.getByRole('combobox', { name: 'Source', exact: true });
  await expect(source.locator('option', { hasText: /^Not recorded \(\d+\)$/ })).toHaveCount(1);
  await source.selectOption('Not recorded');
  await expect(source).toHaveValue('Not recorded');
  const stage = page.getByRole('combobox', { name: 'Lead stage', exact: true });
  await stage.selectOption('New');
  await expect(stage).toHaveValue('New');
  await clear.click();
  await expect(clear).toHaveCount(0);
  await expect(stage).toHaveValue('');
  await expect(source).toHaveValue('');

  await views.getByRole('button', { name: 'List', exact: true }).click();
  const pager = page.getByRole('navigation', { name: 'Leads pages' });
  await expect(pager).toContainText(/of \d+ (records|leads)/);
  await page.reload();
  await expect(views.getByRole('button', { name: 'List', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await capture(page, testInfo, 'leads-admin');
});

test('Contacts lead with role, contact method and location behind one count', async ({
  page,
}, testInfo) => {
  test.setTimeout(180000);
  await openSignIn(page);
  await signIn(page, 'admin-a');
  await page.goto('/#/contacts');
  await addContact(page, 'UIA-CONTACT-1', 'Pilot contact Alpha');

  const contactCount = Number(await page.locator('.record-count-number').innerText());
  await expect(page.locator('.record-count-word')).toHaveText(
    contactCount === 1 ? 'contact' : 'contacts',
  );
  await expect(
    page.getByRole('banner').getByRole('button', { name: 'Create', exact: true }),
  ).toHaveCount(1);
  const group = page.getByRole('group', { name: 'Filter Contacts', exact: true });
  await expect(group.getByRole('button')).toHaveCount(6);
  // Select (Assign to…), Contact, Role, Phone, Linked to.
  await expect(page.locator('.data-table thead th')).toHaveCount(5);
  const head = page.locator('.data-table thead');
  for (const name of ['Contact', 'Role', 'Phone', 'Linked to'])
    await expect(head).toContainText(name);
  await expect(page.locator('.data-table tbody tr').first()).toContainText('Landlord');

  await capture(page, testInfo, 'contacts-admin');
});
