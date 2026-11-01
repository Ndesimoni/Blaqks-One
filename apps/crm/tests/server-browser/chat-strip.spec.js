import { general, send } from '../api/chat-helpers.mjs';
import { assignTeam } from './assign-fixtures.js';
import { memberPage } from './assign-helpers.js';
import { expect, test } from './fixtures.js';

test('wide screens list recent conversations on the right and open one in the messenger', async ({
  browser,
}, testInfo) => {
  const team = await assignTeam('strip');
  const room = await general(team.one);
  const sent = await send(team.one, room.id, 'Strip hello from one');
  expect([200, 201]).toContain(sent.status);
  const member = await memberPage(browser, team.people.two.email);
  try {
    const { page } = member;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    const strip = page.getByRole('complementary', { name: 'Recent conversations' });
    const unread = strip.getByRole('button', {
      name: '#general, Team chat, 1 unread',
      exact: true,
    });
    await expect(unread).toBeVisible();
    await expect(unread.locator('.header-badge')).toHaveText('1');
    await page.screenshot({ path: testInfo.outputPath('chat-strip.png') });

    await unread.click();
    const panel = page.getByRole('dialog', { name: 'Team chat' });
    await expect(panel.getByText('Strip hello from one')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    // Reading the room clears its badge once the panel closes.
    await expect(
      strip.getByRole('button', { name: '#general, Team chat', exact: true }),
    ).toBeVisible();

    await strip.getByRole('button', { name: 'Open the messenger', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Client inbox' })).toBeVisible();
    await page.keyboard.press('Escape');

    // Narrower screens use the header's messenger buttons instead.
    await page.setViewportSize({ width: 1100, height: 900 });
    await expect(strip).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  } finally {
    await member.context.close();
  }
});
