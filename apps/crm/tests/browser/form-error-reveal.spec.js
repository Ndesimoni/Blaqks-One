import { expect, test } from './helpers/session.js';

const workspace = 'kws-crm-v1:workspace:aidah';
const contacts = [
  {
    contact_id: 'CT-MAP',
    full_name: 'Map contact',
    contact_type: 'Building manager',
    map_link: 'https://maps.google.com/?q=Creek',
  },
];
const clients = [
  { client_id: 'CL-REVEAL', full_name: 'Reveal client', lead_quality_score_100: 101 },
];

const seed = (page, data) =>
  page.addInitScript(
    ([key, records]) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify({ data: records, demo: false }));
    },
    [workspace, data],
  );

/** The field's whole wrapper (label, control, error) must sit inside the body's visible box. */
const errorPlacement = (page, key) =>
  page.evaluate((id) => {
    const error = document.getElementById(`${id}-error`);
    const body = error?.closest('.drawer-body');
    if (!body) return 'missing';
    const view = body.getBoundingClientRect();
    const bottom = view.top + body.clientTop + body.clientHeight;
    const box = error.closest('.field').getBoundingClientRect();
    const footer = body.parentElement.querySelector('.drawer-footer').getBoundingClientRect();
    return box.top >= view.top && box.bottom <= bottom && box.bottom <= footer.top
      ? 'visible'
      : `hidden ${Math.round(box.top)}-${Math.round(box.bottom)} in ${Math.round(view.top)}-${Math.round(bottom)}`;
  }, key);

for (const [width, height, motion] of [
  [1280, 800, 'no-preference'],
  [390, 844, 'reduce'],
]) {
  test(`saving an invalid Map link reveals its error above the footer at ${width}px (${motion} motion)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: motion });
    await seed(page, { Contacts: contacts });
    await page.goto('/#/contacts');
    await page.getByRole('button', { name: 'Add contact', exact: true }).click();
    const form = page.getByRole('dialog');
    await form.locator('#contact_id').fill('CT-REVEAL');
    await form.locator('#full_name').fill('Reveal contact');
    const map = form.getByLabel('Map link', { exact: true });
    await map.fill('maps.google.com/?q=Creek');
    // The input is already visible at the body's lower edge, so native focus would not scroll.
    await map.evaluate((input) => input.scrollIntoView({ block: 'end' }));
    await form.getByRole('button', { name: 'Create record', exact: true }).click();
    await expect(map).toBeFocused();
    await expect(map).toHaveAttribute('aria-invalid', 'true');
    await expect(map).toHaveAttribute('aria-describedby', 'map_link-error');
    await expect(form.locator('#map_link-error')).toHaveText(
      'Enter a complete http:// or https:// URL.',
    );
    // Reduced motion scrolls instantly, so the error is in view as soon as focus lands.
    if (motion === 'reduce') expect(await errorPlacement(page, 'map_link')).toBe('visible');
    await expect.poll(() => errorPlacement(page, 'map_link')).toBe('visible');
  });
}

test('saving from review reveals an invalid field on its earlier step at 390px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await seed(page, { Clients: clients });
  await page.goto('/#/clients');
  await page.getByRole('button', { name: 'Open record CL-REVEAL', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Edit record', exact: true }).click();
  const form = page.getByRole('dialog');
  await form.getByRole('button', { name: 'Step 6: Review & save', exact: true }).click();
  await form.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(form.locator('.form-progress')).toContainText('Step 4 of 6');
  const score = form.locator('#lead_quality_score_100');
  await expect(score).toBeFocused();
  await expect(form.locator('#lead_quality_score_100-error')).toHaveText(
    'Enter a value between 0 and 100.',
  );
  await expect.poll(() => errorPlacement(page, 'lead_quality_score_100')).toBe('visible');
});

test('Open map keeps a 44px touch target without growing the detail row', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, { Contacts: contacts });
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/#/contacts');
    await page.getByRole('button', { name: 'Open record CT-MAP', exact: true }).click();
    const details = page.getByRole('dialog');
    const open = details.getByRole('link', { name: 'Open map', exact: true });
    const sizes = await open.evaluate((link) => {
      const field = link.closest('.detail-field');
      const label = field.querySelector('span').getBoundingClientRect();
      const box = link.getBoundingClientRect();
      return {
        height: link.offsetHeight,
        width: link.offsetWidth,
        textLeft: box.left + parseFloat(getComputedStyle(link).paddingLeft),
        labelLeft: label.left,
        rowHeight: field.getBoundingClientRect().height,
      };
    });
    expect(sizes.height, `${width} Open map height`).toBeGreaterThanOrEqual(44);
    expect(sizes.width).toBeGreaterThanOrEqual(44);
    expect(Math.abs(sizes.textLeft - sizes.labelLeft), `${width} text alignment`).toBeLessThan(1);
    expect(sizes.rowHeight, `${width} row height`).toBeLessThan(70);
    await page.keyboard.press('Escape');
    await expect(details).toHaveCount(0);
  }
});
