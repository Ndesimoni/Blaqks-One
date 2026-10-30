import { test, expect } from './fixtures.js';
import {
  aed,
  checkLayout,
  financeDealTeam,
  heldClient,
  layouts,
  memberPage,
  openDeal,
  openDeals,
} from './finance-deals-fixtures.js';

// Net 49,000.00 at 50%: pool 24,500.00, second agent 10% of the pool, company 24,500.00.
const NET = 4_900_000;
const [PRIMARY, SECOND, COMPANY] = [2_205_000, 245_000, 2_450_000];

test('an Admin adds a deal with a live estimate, splits it, earns it and reads the statement', async ({
  browser,
}) => {
  const team = await financeDealTeam('fin-ui-admin');
  const { admin, agent, second } = team.people;
  const clientId = await heldClient(team.agent);
  const { page, context } = await memberPage(browser, admin.email);
  await openDeals(page);
  await expect(page.getByRole('heading', { name: 'No deals yet' })).toBeVisible();
  await page.getByRole('button', { name: 'Add deal', exact: true }).first().click();
  const editor = page.getByRole('dialog', { name: 'New deal' });
  await editor
    .getByLabel('Client')
    .selectOption({ label: `Synthetic finance client (${clientId})` });
  await editor.getByRole('button', { name: 'Next', exact: true }).click();
  await editor.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(editor.getByText('Enter the agreed value.')).toBeVisible();
  await editor.getByLabel('Agreed value AED').fill('2,450,000.001');
  await editor.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(editor.getByText('Enter AED amounts with up to two decimal places.')).toBeVisible();
  await editor.getByLabel('Agreed value AED').fill('2,450,000');
  await editor.getByLabel('Fee rate %').fill('2');
  const estimate = editor.getByRole('region', { name: 'Estimate' });
  await expect(estimate).toContainText(
    'Estimate. Final figures are fixed when the deal is earned.',
  );
  await expect(estimate).toContainText(aed(NET));
  for (const layout of layouts) await checkLayout(page, layout, 'deal-editor-estimate');
  await page.setViewportSize({ width: 1280, height: 900 });
  await editor.getByRole('button', { name: 'Next', exact: true }).click();
  await editor.getByLabel('Deal stage').selectOption('Offer');
  await editor.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(editor.getByRole('region', { name: 'Value & fee' })).toContainText(
    'AED 2,450,000.00',
  );
  await editor.getByRole('button', { name: 'Create deal', exact: true }).click();
  await expect(editor).toHaveCount(0);

  const open = page.getByRole('button', { name: /^Open deal DL-/ }).first();
  const dealId = (await open.textContent()).trim();
  await expect(page.getByRole('table', { name: 'Deals' })).toContainText(agent.name);
  for (const layout of layouts) await checkLayout(page, layout, 'deals-list');
  await page.setViewportSize({ width: 1280, height: 900 });

  const details = await openDeal(page, dealId);
  await expect(details.getByRole('region', { name: 'Commission' })).toContainText('Estimate');
  await details.getByRole('button', { name: 'Change split' }).click();
  const split = page.getByRole('dialog', { name: 'Change split' });
  await split.getByLabel('Second agent', { exact: true }).selectOption({ label: second.name });
  await split.getByLabel('Second agent share %').fill('10');
  await expect(split.getByRole('button', { name: 'Save split' })).toBeDisabled();
  await split.getByLabel('Reason').fill('Joint viewing with a colleague');
  await expect(split.getByLabel('Split before and after')).toContainText(aed(SECOND));
  await split.getByRole('button', { name: 'Save split' }).click();
  await expect(split).toHaveCount(0);
  await expect(details.getByRole('button', { name: 'Change split' })).toBeFocused();
  await expect(details).toContainText(`Second agent · ${second.name}`);

  await details.getByRole('button', { name: 'Mark earned' }).click();
  const earn = page.getByRole('dialog', { name: 'Mark deal earned' });
  const recorded = earn.getByRole('region', { name: 'Will be recorded' });
  await expect(recorded).toContainText(aed(PRIMARY));
  await expect(earn).toContainText('No agreement in force');
  await expect(earn).toContainText('Team default');
  for (const layout of layouts) await checkLayout(page, layout, 'deal-earn-dialog');
  await page.setViewportSize({ width: 1280, height: 900 });
  await earn.getByRole('button', { name: 'Confirm earned' }).click();
  await expect(earn).toHaveCount(0);
  const commission = details.getByRole('region', { name: 'Commission' });
  await expect(commission).toContainText('Earned · revision 1');
  await expect(commission).toContainText(aed(COMPANY));
  await expect(details.getByRole('button', { name: 'Change split' })).toHaveCount(0);
  await details.getByRole('button', { name: 'Close deal details' }).click();
  await expect(page.getByRole('button', { name: `Open deal ${dealId}` }).first()).toBeFocused();

  await page.getByRole('button', { name: 'Commission statement', exact: true }).click();
  await page.getByLabel('Agent', { exact: true }).selectOption({ label: agent.name });
  const lines = page.getByRole('table', { name: `${agent.name}'s statement lines` });
  await expect(lines).toContainText(dealId);
  await expect(lines).toContainText(aed(PRIMARY));
  await expect(page.getByLabel(`${agent.name}'s statement totals`)).toContainText(aed(PRIMARY));
  for (const layout of layouts) await checkLayout(page, layout, 'deals-statement');
  await context.close();
});
