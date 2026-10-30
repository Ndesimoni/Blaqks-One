import { test, expect } from './fixtures.js';
import { assignTeam, held } from './assign-fixtures.js';
import { memberPage, noPageOverflow, openRecord, setTheme } from './assign-helpers.js';
import { focusVisible, readable } from './permissions-visual-helpers.js';

const shotDir = process.env.CONTACTS_ADDRESS_SHOTS;
const shot = (testInfo, name) => (shotDir ? `${shotDir}/${name}` : testInfo.outputPath(name));
const address = 'Unit 1204, Tower 2, Marina Gate, Marina Walk, Dubai Marina, Dubai';

/**
 * WCAG 2.5.8: a target is at least 24px, or a 24px circle on its centre touches no other
 * control in the modal. Returns the rendered size and whether either condition holds.
 */
const targetSpacing = (locator) =>
  locator.evaluate((link) => {
    const box = link.getBoundingClientRect();
    const [x, y] = [box.left + box.width / 2, box.top + box.height / 2];
    const scope = link.closest('dialog, [role=dialog]') || document;
    const others = [...scope.querySelectorAll('a,button,input,select,textarea')];
    const gap = (r) =>
      Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
    const near = others.filter(
      (o) => o !== link && o.offsetParent && gap(o.getBoundingClientRect()) < 12,
    );
    const big = box.width >= 24 && box.height >= 24;
    return {
      width: Math.round(box.width),
      height: Math.round(box.height),
      clearance: big || !near.length,
    };
  });

/** Tabs forward through the dialog until the Open map link holds focus. */
async function tabToOpenMap(page) {
  for (let step = 0; step < 40; step++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => document.activeElement?.textContent?.trim() === 'Open map'))
      return;
  }
  throw Error('Keyboard focus never reached Open map.');
}

test('contact address and Open map reflow and stay keyboard reachable at 390 and 1280px in both themes', async ({
  browser,
}, testInfo) => {
  const team = await assignTeam('ctaddrview');
  await held(team, 'Contacts', {
    contact_id: 'CT-ADDR-V',
    full_name: 'Addr view',
    contact_type: 'Security guard',
    building_project: 'Marina Gate 2',
    address,
    map_link: 'https://www.google.com/maps/search/?api=1&query=Marina+Gate+2',
  });
  const { page, context } = await memberPage(browser, team.people.admin.email);
  const [errors, sizes] = [[], []];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    for (const width of [390, 1280])
      for (const theme of ['light', 'dark']) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto('/#/contacts');
        await setTheme(page, theme);
        const details = await openRecord(page, 'CT-ADDR-V');
        await expect(details.locator('.detail-field strong', { hasText: address })).toBeVisible();
        const open = details.getByRole('link', { name: 'Open map', exact: true });
        await tabToOpenMap(page);
        await expect(open).toBeFocused();
        await expect(open).toBeInViewport();
        await focusVisible(page);
        await readable(open, `${width} ${theme} Open map`);
        const target = await targetSpacing(open);
        expect(target.clearance, `${width} ${theme} ${JSON.stringify(target)}`).toBe(true);
        sizes.push(`${width}-${theme}: ${target.width}x${target.height}px`);
        await noPageOverflow(page);
        const fits = await details.evaluate((node) => node.scrollWidth <= node.clientWidth + 1);
        expect(fits, `${width} ${theme} details width`).toBe(true);
        await page.screenshot({ path: shot(testInfo, `contact-map-${width}-${theme}.png`) });
        await page.keyboard.press('Escape');
        await expect(details).toHaveCount(0);
      }
    testInfo.annotations.push({ type: 'Open map target', description: sizes.join(', ') });
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
