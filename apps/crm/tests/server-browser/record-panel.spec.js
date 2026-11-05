import { test, expect } from './fixtures.js';
import { assignTeam, held } from './assign-fixtures.js';
import { memberPage, noPageOverflow, openRecord, setTheme } from './assign-helpers.js';
import { openPage } from './product-nav.js';
import { openName } from './record-open.js';

const NAME = 'Panel client Layla';
const SIZES = [
  [1280, 860],
  [390, 844],
];

/** A client with activity in all four collections, a lost lead, and a stranger's task. */
async function panelTeam(prefix) {
  const team = await assignTeam(prefix);
  const client = (client_id, full_name, lead_stage) =>
    held(team, 'Clients', { client_id, full_name, lead_stage, lead_source: 'Website' });
  await client('CL-RP-1', NAME, 'Viewing');
  await client('CL-RP-2', 'Panel client lost', 'Lost');
  await held(team, 'Follow-ups', {
    client_id: 'CL-RP-1',
    next_action: 'Send the Marina shortlist',
    contact_date: '2026-10-20',
    task_status: 'Open',
  });
  await held(team, 'Interaction log', {
    client_id: 'CL-RP-1',
    conversation_topic: 'Asked about parking',
    contacted_on_uae_time: '2026-10-27 09:40',
  });
  await held(team, 'Client care', {
    client_id: 'CL-RP-1',
    touchpoint_type: 'Birthday',
    conversation_notes: 'Card sent.',
  });
  await held(team, 'Follow-ups', { client_id: 'CL-RP-2', next_action: 'Another client task' });
  return team;
}

/** Full height at the right edge: 920px at most on desktop, the whole screen on phones. */
async function expectPanelLayout(page, panel, width) {
  const viewport = page.viewportSize();
  const box = await panel.locator('.drawer').boundingBox();
  expect(Math.round(box.x + box.width)).toBe(viewport.width);
  expect([box.y, Math.round(box.height)]).toEqual([0, viewport.height]);
  if (width < 760) expect(box.x).toBe(0);
  else expect([box.width <= 920, box.x >= 96]).toEqual([true, true]);
  const main = await panel.locator('.record-panel-main').boundingBox();
  const side = await panel.locator('.record-panel-side').boundingBox();
  if (width >= 1024) expect(main.x + main.width).toBeLessThanOrEqual(side.x);
  else expect(side.y).toBeGreaterThanOrEqual(main.y + main.height);
  const close = panel.getByRole('button', { name: 'Close record details', exact: true });
  await expect(close).toBeInViewport();
  const fits = (node) => node.scrollWidth <= node.clientWidth + 1;
  expect(await panel.locator('.drawer').evaluate(fits)).toBe(true);
  await noPageOverflow(page);
}

test('client details open as a right-edge panel with the stage track and activity', async ({
  browser,
}, testInfo) => {
  test.setTimeout(150000);
  const team = await panelTeam('rpanel');
  const { page, context } = await memberPage(browser, team.people.admin.email);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  try {
    for (const theme of ['dark', 'light']) {
      await page.setViewportSize({ width: 1280, height: 860 });
      await setTheme(page, theme);
      for (const [width, height] of SIZES) {
        await page.setViewportSize({ width, height });
        const open = page.getByRole('button', { name: openName('CL-RP-1') });
        const panel = await openRecord(page, 'CL-RP-1');
        await expect(panel).toHaveAccessibleName(NAME);
        await expect(panel.getByRole('heading', { level: 2, name: NAME })).toBeFocused();
        await expect(panel.locator('.record-panel-title p')).toHaveText(
          'Client · Website · CL-RP-1',
        );
        const track = panel.getByRole('list', { name: 'Lead stage: Viewing', exact: true });
        await expect(track.getByRole('listitem')).toHaveCount(7);
        await expect(track.locator('[aria-current="step"]')).toHaveText('Viewing');
        // The former footer actions sit in the header, above the scrolling body.
        const actions = panel.locator('.drawer-footer');
        await expect(actions.getByRole('button')).toHaveText(['Delete', 'Edit record']);
        const body = await panel.locator('.drawer-body').boundingBox();
        expect((await actions.boundingBox()).y).toBeLessThan(body.y);
        const activity = panel.getByRole('region', { name: 'Activity', exact: true });
        await expect(activity).toContainText('3 entries');
        const items = activity.getByRole('listitem');
        await expect(items).toHaveCount(3);
        await expect(items.nth(0)).toContainText('Asked about parking');
        await expect(items.nth(0)).toContainText('09:40');
        await expect(items.nth(1)).toContainText('Send the Marina shortlist');
        await expect(items.nth(2)).toContainText('Birthday');
        await expect(items.nth(2)).toContainText('No date');
        await expect(activity).not.toContainText('Another client task');
        await expectPanelLayout(page, panel, width);
        await page.screenshot({ path: testInfo.outputPath(`record-panel-${width}-${theme}.png`) });
        await page.keyboard.press('Escape');
        await expect(panel).toHaveCount(0);
        await expect(open).toBeFocused();
      }
    }
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('leads keep Edit lead, and a lost lead marks no stage on the track', async ({ browser }) => {
  const team = await panelTeam('rpanellead');
  const { page, context } = await memberPage(browser, team.people.admin.email);
  try {
    await page.setViewportSize({ width: 1280, height: 860 });
    const lost = await openRecord(page, 'CL-RP-2');
    const track = lost.getByRole('list', { name: 'Lead stage: Lost', exact: true });
    await expect(track.locator('[aria-current]')).toHaveCount(0);
    await expect(lost.getByText('Outside the pipeline: Lost', { exact: true })).toBeVisible();
    await lost.getByRole('button', { name: 'Close record details', exact: true }).click();
    await expect(lost).toHaveCount(0);

    await openPage(page, 'Leads');
    await page.getByRole('button', { name: 'List', exact: true }).click();
    const lead = await openRecord(page, 'CL-RP-1');
    await expect(lead.locator('.record-panel-title p')).toHaveText('Lead · Website · CL-RP-1');
    await lead.getByRole('button', { name: 'Edit lead', exact: true }).click();
    const editor = page.getByRole('dialog');
    await expect(editor.getByLabel('Full name')).toHaveValue(NAME);
    await editor.getByRole('button', { name: 'Close record editor', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
