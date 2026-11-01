import { expect, test } from './fixtures.js';
import { add } from '../api/assignment-helpers.mjs';
import { login } from '../api/helpers.mjs';
import { dubaiToday, shiftDay } from '../../src/lib/dubaiDate.js';
import { signIn } from './helpers.js';

test('deadline groups retain search, list preference and the record slider', async ({ page }) => {
  const admin = await login();
  const today = dubaiToday();
  await add(admin, 'Clients', { client_id: 'DL-CLIENT', full_name: 'Synthetic deadline client' });
  for (const [id, due, status] of [
    ['DL-OVERDUE', shiftDay(today, -1), 'Open'],
    ['DL-TODAY', today, 'Open'],
    ['DL-FUTURE', shiftDay(today, 2), 'Open'],
    ['DL-UNDATED', '', 'Open'],
    ['DL-CLOSED', shiftDay(today, -2), 'Completed'],
  ]) {
    await add(admin, 'Follow-ups', {
      activity_id: id,
      client_id: 'DL-CLIENT',
      next_action: `Synthetic action ${id}`,
      due_date: due,
      task_status: status,
    });
  }
  await signIn(page);
  await page.goto('/#/follow-ups');
  await page.getByLabel('Search Follow-ups', { exact: true }).fill('DL-');
  await expect(page.getByRole('button', { name: 'Deadline', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  for (const title of ['Overdue', 'Today', 'Upcoming', 'No due date', 'Closed'])
    await expect(page.getByRole('heading', { name: new RegExp(`^${title}`) })).toBeVisible();
  await page.getByRole('button', { name: 'Overdue', exact: true }).click();
  await expect(page.locator('.deadline-row')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Open record DL-OVERDUE', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Today/ })).toHaveCount(0);
  // Choosing the pressed preset again returns to the default, All follow-ups.
  await page.getByRole('button', { name: 'Overdue', exact: true }).click();
  await page.getByRole('button', { name: 'Open record DL-TODAY', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Synthetic action DL-TODAY');
  await page.keyboard.press('Escape');
  await page.getByLabel('Search Follow-ups', { exact: true }).fill('DL-CLOSED');
  await expect(page.getByRole('heading', { name: /^Closed/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Overdue/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Follow-ups records', exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Open record DL-CLOSED', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'List', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
