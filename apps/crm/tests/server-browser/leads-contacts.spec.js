import { setTheme } from './assign-helpers.js';
import { expect, test } from './fixtures.js';
import { addClient, saveRecordForm, signIn } from './helpers.js';

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
  await expect(page.getByLabel('Email address')).toBeVisible({ timeout: 60000 });
}

async function addContact(page, id, name) {
  await page.getByRole('button', { name: 'Add contact', exact: true }).click();
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
  await expect(page.getByRole('button', { name: 'Add lead', exact: true })).toHaveCount(1);
  const pager = page.getByRole('navigation', { name: 'Leads pages' });
  await expect(pager).toContainText(/of \d+ (records|leads)/);

  const sources = page.getByRole('group', { name: 'Filter leads by source', exact: true });
  const notRecorded = sources.getByRole('button', { name: /^Not recorded \d+$/ });
  await expect(notRecorded).toBeVisible();
  await notRecorded.click();
  await expect(notRecorded).toHaveAttribute('aria-pressed', 'true');
  const clear = page.getByRole('button', { name: 'Clear filters', exact: true });
  await expect(clear).toBeEnabled();
  const stage = page.getByRole('combobox', { name: 'Lead stage', exact: true });
  await stage.selectOption('New');
  await expect(stage).toHaveValue('New');
  await clear.click();
  await expect(clear).toBeDisabled();
  await expect(stage).toHaveValue('');

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
  await expect(page.getByRole('button', { name: 'Add contact', exact: true })).toHaveCount(1);
  const group = page.getByRole('group', { name: 'Filter Contacts', exact: true });
  await expect(group.getByRole('button')).toHaveCount(6);
  await expect(page.locator('.data-table thead th')).toHaveCount(8);
  const head = page.locator('.data-table thead');
  for (const name of ['Contact type', 'Phone', 'Email', 'Company', 'Building / project'])
    await expect(head).toContainText(name);
  await expect(page.locator('.data-table tbody tr').first()).toContainText('Landlord');

  await capture(page, testInfo, 'contacts-admin');
});
