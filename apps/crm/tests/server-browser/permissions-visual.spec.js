import { test, expect } from './fixtures.js';
import { memberPage, noPageOverflow, setTheme } from './assign-helpers.js';
import {
  actions,
  assignTeam,
  editTeammate,
  held,
  LABELS,
  moduleBox,
  setGrants,
} from './permissions-fixtures.js';
import { focusVisible, readable, tallTargets } from './permissions-visual-helpers.js';

const SIZES = [
  [390, 844],
  [1280, 900],
];

test('action ticks, delete states and review are keyboard-operable and reflow in both themes', async ({
  browser,
}, testInfo) => {
  test.setTimeout(180000);
  const team = await assignTeam('pvisual');
  const admin = await memberPage(browser, team.people.admin.email);
  const { page } = admin;
  const shot = (name) => page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const theme of ['light', 'dark'])
      for (const [width, height] of SIZES) {
        const tag = `${width}-${theme}`;
        await page.setViewportSize({ width, height });
        await page.goto('/#/team-access');
        await setTheme(page, theme);
        const dialog = await editTeammate(page, 'Synthetic pvisual-one');
        const rel = dialog.getByRole('group', { name: `${LABELS.rel}: What they can do` });
        const del = rel.getByRole('checkbox', { name: 'Delete clients & contacts' });
        await rel.scrollIntoViewIfNeeded();
        await expect(del).toBeDisabled();
        await tallTargets(dialog.locator('.team-action-options label'), tag);
        await readable(rel.locator('legend'), `${tag} legend`);
        await readable(rel.locator('.team-action-help'), `${tag} helper`);
        await readable(rel.getByText('Add', { exact: true }), `${tag} tick label`);
        await noPageOverflow(page);
        const panel = await dialog.locator('.drawer').boundingBox();
        expect(panel.x + panel.width).toBeLessThanOrEqual(width + 1);
        await shot(`team-ticks-disabled-${tag}`);

        // Keyboard: module box → Add → Edit → Hand on → (disabled delete skipped) → next module.
        await moduleBox(dialog, LABELS.rel).focus();
        for (const name of ['Add', 'Edit', 'Hand on']) {
          await page.keyboard.press('Tab');
          await expect(rel.getByRole('checkbox', { name, exact: true })).toBeFocused();
          await focusVisible(page);
        }
        await page.keyboard.press('Tab');
        await expect(moduleBox(dialog, LABELS.prop)).toBeFocused();

        await dialog.getByRole('radio', { name: "Whole team's records" }).check();
        await moduleBox(dialog, LABELS.rel).focus();
        for (let index = 0; index < 4; index++) await page.keyboard.press('Tab');
        await expect(del).toBeFocused();
        await focusVisible(page);
        await page.keyboard.press('Space');
        await expect(del).toBeChecked();
        await readable(rel.locator('label.team-action-sensitive'), `${tag} sensitive label`);
        await rel.scrollIntoViewIfNeeded();
        await noPageOverflow(page);
        await shot(`team-ticks-enabled-${tag}`);

        await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
        const flag = dialog.locator('.team-action-flag');
        await expect(flag).toHaveText('Sensitive: Delete clients & contacts');
        await readable(flag, `${tag} sensitive flag`);
        await readable(dialog.locator('.team-action-review dt').first(), `${tag} review term`);
        await flag.scrollIntoViewIfNeeded();
        await noPageOverflow(page);
        await shot(`team-review-${tag}`);
        page.once('dialog', (confirmation) => confirmation.accept());
        await dialog.getByRole('button', { name: 'Close team form' }).click();
        await expect(dialog).toHaveCount(0);
      }
  } finally {
    await admin.context.close();
  }
});

test('the view-only Clients page shows a readable chip without overflow in both themes', async ({
  browser,
}, testInfo) => {
  test.setTimeout(120000);
  const team = await assignTeam('pchip');
  await setGrants(team, 'one', { actions: actions(false) });
  await held(
    team,
    'Clients',
    { full_name: 'A very long view-only client name for wrapping checks' },
    team.people.one.id,
  );
  const staff = await memberPage(browser, team.people.one.email);
  const { page } = staff;
  try {
    for (const theme of ['light', 'dark'])
      for (const [width, height] of SIZES) {
        const tag = `${width}-${theme}`;
        await page.setViewportSize({ width, height });
        await page.goto('/#/clients');
        await setTheme(page, theme);
        const chip = page.locator('.view-only-chip');
        await expect(chip).toBeVisible();
        await expect(chip).toContainText('View only');
        await readable(chip, `${tag} chip`);
        const box = await chip.boundingBox();
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        await expect(page.getByRole('button', { name: /^Add\b/ })).toHaveCount(0);
        await noPageOverflow(page);
        await page.screenshot({ path: testInfo.outputPath(`view-only-clients-${tag}.png`) });
      }
  } finally {
    await staff.context.close();
  }
});
