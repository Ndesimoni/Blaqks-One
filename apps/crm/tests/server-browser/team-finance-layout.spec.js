import { test, expect } from './fixtures.js';
import { readable, tallTargets, focusVisible } from './permissions-visual-helpers.js';
import { editTeammate, financeTicks, memberPage, noPageOverflow } from './team-finance-fixtures.js';
import {
  openFinanceSettings,
  saveSettings,
  setTheme,
  teamFinance,
} from './team-finance-fixtures.js';

const SIZES = [
  [390, 844],
  [1280, 900],
];

test('finance ticks and finance settings reflow, stay readable and work by keyboard', async ({
  browser,
}, testInfo) => {
  test.setTimeout(180000);
  const team = await teamFinance('tflayout');
  await saveSettings(team, { agentShareBp: 5000 });
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
        const dialog = await editTeammate(page, team.people.agent.name);
        const { group, view } = financeTicks(dialog);
        await group.scrollIntoViewIfNeeded();
        await expect(view).toBeDisabled();
        await tallTargets(group.locator('.team-action-options label'), `${tag} ticks`);
        for (const help of await group.locator('.team-action-help').all())
          await readable(help, `${tag} finance helper`);
        await noPageOverflow(page);
        const drawer = await dialog.locator('.drawer').boundingBox();
        expect(drawer.x + drawer.width).toBeLessThanOrEqual(width + 1);
        // Keyboard: Hand on → (disabled sensitive ticks skipped) → next CRM access box.
        await group.getByRole('checkbox', { name: 'Hand on', exact: true }).focus();
        await page.keyboard.press('Tab');
        await expect(dialog.getByRole('checkbox', { name: /^Reports/ })).toBeFocused();
        await shot(`team-finance-ticks-${tag}`);
        page.once('dialog', (confirmation) => confirmation.accept());
        await dialog.getByRole('button', { name: 'Close team form' }).click();
        await expect(dialog).toHaveCount(0);

        const panel = await openFinanceSettings(page);
        await noPageOverflow(page);
        await tallTargets(page.locator('.team-tabs button'), `${tag} tabs`);
        await tallTargets(panel.locator('input:not([type=radio]):not([type=checkbox])'), tag);
        await tallTargets(panel.locator('.team-finance-choice > label'), `${tag} choices`);
        for (const hint of await panel.locator('.finance-hint').all())
          await readable(hint, `${tag} settings hint`);
        await readable(panel.locator('.team-finance-heading p'), `${tag} intro`);
        const people = page.getByRole('button', { name: 'People', exact: true });
        await page.getByRole('button', { name: 'Finance settings', exact: true }).focus();
        await page.keyboard.press('Shift+Tab');
        await expect(people).toBeFocused();
        await focusVisible(page);
        await page.keyboard.press('Enter');
        await expect(people).toHaveAttribute('aria-pressed', 'true');
        await page.getByRole('button', { name: 'Finance settings', exact: true }).click();
        const editor = page.getByRole('region', { name: 'Add an agreement' });
        await editor.scrollIntoViewIfNeeded();
        await tallTargets(editor.locator('input, select, .btn'), `${tag} agreement editor`);
        await noPageOverflow(page);
        await shot(`team-finance-settings-${tag}`);
        // The page keeps its tab across same-route navigation; return to People for the next round.
        await people.click();
      }
  } finally {
    await admin.context.close();
  }
});
