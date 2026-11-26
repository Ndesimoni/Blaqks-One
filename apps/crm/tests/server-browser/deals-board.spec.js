import { test, expect } from './fixtures.js';
import {
  checkLayout,
  createDeal,
  earnDeal,
  financeDealTeam,
  heldClient,
  layouts,
  memberPage,
} from './finance-deals-fixtures.js';
import { actions, FINANCE, grant, withFinance } from '../api/permission-helpers.mjs';

/** A pipeline column by its heading; `has` takes a locator relative to each column. */
const column = (board, stage) =>
  board
    .locator('.kanban-column')
    .filter({ has: board.page().getByRole('heading', { name: stage, exact: true }) });

test('Deals open as a pipeline: a deal moves stage on the server and the view is remembered', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const team = await financeDealTeam('fin-ui-board');
  const clientId = await heldClient(team.agent);
  const deal = await createDeal(team.admin, clientId, { stage: 'Viewing' });
  let earned = await createDeal(team.admin, clientId, { stage: 'Viewing' });
  earned = await earnDeal(team.admin, earned);
  const { page, context } = await memberPage(browser, team.people.admin.email);
  await page.goto('/#/deals');
  const board = page.getByRole('region', { name: 'Deals pipeline' });
  const open = `Open deal ${deal.dealId}`;
  await expect(column(board, 'Viewing').getByRole('button', { name: open })).toBeVisible();

  await page.getByRole('button', { name: `Move deal ${deal.dealId} to another stage` }).click();
  await page.getByRole('button', { name: 'Negotiation', exact: true }).click();
  await expect(page.locator('.toast')).toContainText(`Deal ${deal.dealId} moved to Negotiation`);
  await expect(column(board, 'Negotiation').getByRole('button', { name: open })).toBeVisible();
  await expect(column(board, 'Negotiation').getByRole('button', { name: open })).toBeFocused();

  await page.getByRole('button', { name: `Move deal ${earned.dealId} to another stage` }).click();
  await page.getByRole('button', { name: 'Lost', exact: true }).click();
  await expect(page.locator('.toast')).toContainText(
    'Unearn this deal before marking it lost or cancelled.',
  );
  await expect(
    column(board, 'Completed').getByRole('button', { name: `Open deal ${earned.dealId}` }),
  ).toBeVisible();
  // Saved on the server, so a fresh load keeps it.
  await page.reload();
  await expect(column(board, 'Negotiation').getByRole('button', { name: open })).toBeVisible();
  await expect(column(board, 'Viewing').getByRole('button', { name: open })).toHaveCount(0);

  for (const layout of layouts) await checkLayout(page, layout, 'deals-board');
  await page.setViewportSize({ width: 1280, height: 900 });

  const views = page.getByRole('group', { name: 'View', exact: true });
  await views.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Deals' })).toContainText(deal.dealId);
  await page.reload();
  await expect(views.getByRole('button', { name: 'List', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await context.close();

  await grant(team.admin, team.viewer, {
    recordScope: 'team',
    actions: withFinance(actions(), { ...FINANCE.preset, edit: false, teamView: true }),
  });
  const viewer = await memberPage(browser, 'fin-ui-board-viewer@team-fixture.test');
  await viewer.page.goto('/#/deals');
  await expect(viewer.page.getByRole('region', { name: 'Deals pipeline' })).toBeVisible();
  await expect(
    viewer.page.getByRole('button', { name: `Move deal ${deal.dealId} to another stage` }),
  ).toHaveCount(0);
  await viewer.context.close();
});
