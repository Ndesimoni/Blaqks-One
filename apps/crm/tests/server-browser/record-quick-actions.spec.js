import { test, expect } from './fixtures.js';
import { assignTeam, held } from './assign-fixtures.js';
import { memberPage, openRecord, setTheme } from './assign-helpers.js';
import { openPage } from './product-nav.js';

/** A client with a few facts filled and a landlord contact (design queue item 36). */
async function quickTeam(prefix) {
  const team = await assignTeam(prefix);
  await held(team, 'Clients', {
    client_id: 'CL-QA-1',
    full_name: 'Quick client Layla',
    lead_stage: 'Viewing',
    lead_source: 'Website',
    phone: '+971 50 000 0141',
  });
  await held(team, 'Contacts', {
    contact_id: 'CT-QA-1',
    full_name: 'Quick landlord Hassan',
    contact_type: 'Landlord',
  });
  return team;
}

test('sliders list filled facts and offer Convert to deal and Add a property', async ({
  browser,
}, testInfo) => {
  test.setTimeout(150000);
  const team = await quickTeam('rquick');
  const { page, context } = await memberPage(browser, team.people.admin.email);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  try {
    await page.setViewportSize({ width: 1280, height: 860 });
    await setTheme(page, 'light');
    let panel = await openRecord(page, 'CL-QA-1');
    // Only filled facts at first; the link brings the empty ones back in place, and hides them.
    const facts = panel.locator('.record-facts');
    await expect(facts).toContainText('+971 50 000 0141');
    await expect(facts.locator('.detail-field', { hasText: 'Email' })).toHaveCount(0);
    const more = facts.getByRole('button', { name: /^Show \d+ empty fields$/ });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await more.click();
    await expect(facts.locator('.detail-field', { hasText: 'Email' })).toContainText('—');
    await facts.getByRole('button', { name: 'Hide empty fields', exact: true }).click();
    await expect(facts.locator('.detail-field', { hasText: 'Email' })).toHaveCount(0);
    // Convert to deal is the primary and opens New deal with this client chosen.
    const head = panel.locator('.record-panel-head');
    const convert = head.getByRole('button', { name: 'Convert to deal', exact: true });
    await expect(convert).toHaveClass(/btn-primary/);
    await expect(head.getByRole('button', { name: 'Edit record' })).toHaveClass(/btn-light/);
    // Share, then Call and Message as icons; Delete as an icon too, so the actions fit one row.
    await expect(head.getByRole('link', { name: /^Call / })).toHaveClass(/record-icon-action/);
    const tops = await head
      .locator('.record-panel-actions .btn')
      .evaluateAll((buttons) => [
        ...new Set(buttons.map((b) => Math.round(b.getBoundingClientRect().top))),
      ]);
    expect(tops).toHaveLength(1);
    await page.screenshot({ path: testInfo.outputPath('client-slider-light.png') });
    await convert.click();
    const editor = page.getByRole('dialog', { name: 'New deal', exact: true });
    await expect(editor).toBeVisible();
    await expect(editor.getByLabel('Client')).toHaveValue('CL-QA-1');
    await expect(page).toHaveURL(/#\/deals$/);

    // A contact's Add a property opens the property form linked to them.
    await page.keyboard.press('Escape');
    await expect(editor).toHaveCount(0);
    await openPage(page, 'Contacts');
    await setTheme(page, 'dark');
    panel = await openRecord(page, 'CT-QA-1');
    await page.screenshot({ path: testInfo.outputPath('contact-slider-dark.png') });
    await panel.getByRole('button', { name: 'Add a property', exact: true }).click();
    const form = page.getByRole('dialog');
    await expect(form.getByLabel('Contact ID', { exact: true })).toHaveValue('CT-QA-1');
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
