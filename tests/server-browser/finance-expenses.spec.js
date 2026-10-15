import { test, expect } from './fixtures.js';
import {
  aed,
  approvalTeam,
  checkLayout,
  entryRow,
  layouts,
  memberPage,
  openEntries,
  openEntry,
  overview,
} from './finance-payments-fixtures.js';

const LINK = 'https://files.example.test/receipts/synthetic-1.pdf';

test('staff record expenses for themselves with a safe https receipt link', async ({ browser }) => {
  const team = await approvalTeam('fin-ui-exp');
  const { page, context } = await memberPage(browser, team.people.agent.email);
  await openEntries(page, 'expenses');
  await page.getByRole('button', { name: 'Add expense', exact: true }).first().click();
  const form = page.getByRole('dialog', { name: 'Add expense' });
  await expect(form.getByText('Recorded for yourself.')).toBeVisible();
  await expect(form.getByLabel('Incurred by')).toHaveCount(0);
  await form.getByLabel('Amount (AED)').fill('1,500');
  await form.getByLabel('Category').fill('Marketing');
  await form.getByLabel('Supplier').fill('Synthetic Print Co');
  await form.getByLabel('Receipt link').fill('http://files.example.test/receipt.pdf');
  await form.getByRole('button', { name: 'Submit expense', exact: true }).click();
  await expect(form.getByText('Enter a valid HTTPS receipt link.')).toBeVisible();
  await expect(form.getByLabel('Receipt link')).toBeFocused();
  await form.getByLabel('Receipt link').fill(LINK);
  const today = await form.getByLabel('Date paid').inputValue();
  await form.getByLabel('Date paid').fill('2099-01-01');
  await form.getByRole('button', { name: 'Submit expense', exact: true }).click();
  await expect(
    form.getByText('Payment and expense dates cannot be in the future.', { exact: true }),
  ).toBeVisible();
  await form.getByLabel('Date paid').fill(today);
  for (const layout of layouts) await checkLayout(page, layout, 'expense-form');
  await page.setViewportSize({ width: 1280, height: 900 });
  await form.getByRole('button', { name: 'Submit expense', exact: true }).click();
  await expect(form).toHaveCount(0);

  const [expense] = (await overview(team.agent, team.admin)).expenses;
  expect(expense.incurredBy.id).toBe(team.people.agent.id);
  const row = entryRow(page, 'expenses', expense.expenseId);
  await expect(row).toContainText('Pending approval');
  await expect(row).toContainText(aed(150_000));
  const link = row.getByRole('link', { name: /Open receipt/ });
  await expect(link).toHaveAttribute('href', LINK);
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toContainText('files.example.test');
  for (const layout of layouts) await checkLayout(page, layout, 'expenses-own');
  await context.close();
});

test('the Admin records an expense on behalf of a team member, who then sees it as theirs', async ({
  browser,
}) => {
  const team = await approvalTeam('fin-ui-exp-admin');
  const { agent, second } = team.people;
  const admin = await memberPage(browser, team.people.admin.email);
  await openEntries(admin.page, 'expenses');
  const add = async (owner, amount) => {
    await admin.page.getByRole('button', { name: 'Add expense', exact: true }).first().click();
    const form = admin.page.getByRole('dialog', { name: 'Add expense' });
    const picker = form.getByLabel('Incurred by');
    await expect(picker.locator('option').first()).toHaveText(/^For myself/);
    if (owner) await picker.selectOption(owner);
    await form.getByLabel('Amount (AED)').fill(amount);
    await form.getByRole('button', { name: 'Submit expense', exact: true }).click();
    await expect(form).toHaveCount(0);
  };
  await add(agent.id, '250');
  await add(null, '900');
  const rows = (await overview(team.admin)).expenses;
  const owners = rows.map((row) => row.incurredBy.id).sort();
  expect(owners).toEqual([agent.id, team.admin.user.id].sort());
  const forAgent = rows.find((row) => row.incurredBy.id === agent.id);
  await expect(entryRow(admin.page, 'expenses', forAgent.expenseId)).toContainText(agent.name);
  await expect(admin.page.getByRole('button', { name: /Awaiting approval/ })).toContainText('2');
  for (const layout of layouts) await checkLayout(admin.page, layout, 'expenses-team');
  await admin.context.close();

  const own = await memberPage(browser, agent.email);
  await openEntries(own.page, 'expenses');
  // The header row and the one expense the agent incurred; the Admin's own stays hidden.
  await expect(own.page.getByRole('table', { name: 'Expenses' }).getByRole('row')).toHaveCount(2);
  const details = await openEntry(own.page, forAgent.expenseId);
  const submitter = details.locator('.finance-fact').filter({ hasText: 'Submitted by' });
  await expect(submitter).toContainText(team.people.admin.name);
  await expect(details.getByRole('button', { name: /^(Approve|Reject|Void)/ })).toHaveCount(0);
  await own.context.close();
  const hidden = await memberPage(browser, second.email);
  await openEntries(hidden.page, 'expenses');
  await expect(hidden.page.getByText(forAgent.expenseId)).toHaveCount(0);
  await hidden.context.close();
});
