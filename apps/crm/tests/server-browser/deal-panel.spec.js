import { test, expect } from './fixtures.js';
import {
  createDeal,
  earnDeal,
  financeDealTeam,
  heldClient,
  memberPage,
  noPageOverflow,
  openDeal,
  openDeals,
} from './finance-deals-fixtures.js';

test('a deal opens as the mockup slider: stage bar, Move to the next stage, Record payment', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const team = await financeDealTeam('fin-ui-panel');
  const clientId = await heldClient(team.admin);
  const open = await createDeal(team.admin, clientId, { stage: 'Negotiation' });
  const earned = await earnDeal(
    team.admin,
    await createDeal(team.admin, clientId, { stage: 'Completed' }),
  );
  const { page, context } = await memberPage(browser, team.people.admin.email);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Without the slide-in, the slider's edge can be measured at once.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await openDeals(page);

  const slider = await openDeal(page, open.dealId);
  // A right-edge slider, 920px at most, with the deal's name over its kind, client and ID.
  const box = await slider.locator('.drawer').boundingBox();
  expect(Math.round(box.x + box.width)).toBe(1280);
  expect(box.width).toBeLessThanOrEqual(920);
  await expect(slider.getByRole('heading', { level: 2, name: 'Sale deal' })).toBeFocused();
  await expect(slider.locator('.record-panel-title p')).toHaveText(
    `Deal · Synthetic finance client · ${open.dealId}`,
  );
  const track = slider.getByRole('list', { name: 'Deal stage: Negotiation', exact: true });
  await expect(track.locator('[aria-current="step"]')).toHaveText('Negotiation');
  await expect(slider.getByRole('region', { name: 'Payments' })).toContainText(
    'Payments are recorded once the deal is earned.',
  );
  await expect(slider.getByRole('button', { name: 'Record payment' })).toHaveCount(0);

  // Move to the next stage saves on the server, as the board's move does.
  await slider.getByRole('button', { name: 'Move to Documentation', exact: true }).click();
  await expect(page.locator('.toast')).toContainText(`Deal ${open.dealId} moved to Documentation`);
  await expect(
    slider.getByRole('list', { name: 'Deal stage: Documentation', exact: true }),
  ).toBeVisible();
  await expect(
    slider.getByRole('button', { name: 'Move to Completed', exact: true }),
  ).toBeVisible();
  await noPageOverflow(page);
  await slider.getByRole('button', { name: 'Close deal details' }).click();

  // An earned deal offers Record payment, with this deal already chosen.
  const done = await openDeal(page, earned.dealId);
  await expect(done.getByRole('button', { name: /^Move to / })).toHaveCount(0);
  await done.getByRole('button', { name: 'Record payment', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Record payment', exact: true });
  await expect(form.getByLabel('Earned deal')).toHaveValue(earned.dealId);
  await form.getByRole('button', { name: 'Cancel' }).click();
  await expect(form).toHaveCount(0);
  await expect(done).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(done.getByRole('button', { name: 'Close deal details' })).toBeInViewport();
  await noPageOverflow(page);
  expect(errors).toEqual([]);
  await context.close();
});
