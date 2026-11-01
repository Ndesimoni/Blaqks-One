import { expect, test } from './fixtures.js';
import { add } from '../api/assignment-helpers.mjs';
import { login } from '../api/helpers.mjs';
import { dubaiToday, shiftDay } from '../../src/lib/dubaiDate.js';
import { signIn } from './helpers.js';
import { openName } from './record-open.js';

test('week view preserves dated and unscheduled viewings, navigation and List preference', async ({
  page,
}) => {
  const admin = await login();
  const today = dubaiToday();
  await add(admin, 'Clients', { client_id: 'WK-CLIENT', full_name: 'Synthetic calendar client' });
  for (const [id, when] of [
    ['WK-EARLY', `${today} 09:00`],
    ['WK-LATE', `${today} 15:30`],
    ['WK-NEXT', `${shiftDay(today, 7)} 10:00`],
    ['WK-UNDATED', ''],
  ]) {
    await add(admin, 'Viewings', {
      viewing_id: id,
      client_id: 'WK-CLIENT',
      appointment_date_time: when,
      viewing_status: 'Scheduled',
    });
  }
  await signIn(page);
  await page.goto('/#/viewings');
  await page.getByLabel('Search Viewings', { exact: true }).fill('WK-');
  await expect(page.getByRole('button', { name: 'Week', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText(/^Dubai time/)).toBeVisible();
  await expect(page.getByRole('button', { name: openName('WK-EARLY') })).toBeVisible();
  await expect(page.getByRole('button', { name: openName('WK-LATE') })).toBeVisible();
  await expect(page.getByRole('button', { name: openName('WK-NEXT') })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /^Unscheduled/ })).toBeVisible();
  await expect(page.getByRole('button', { name: openName('WK-UNDATED') })).toBeVisible();
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await expect(page.getByRole('button', { name: openName('WK-NEXT') })).toBeVisible();
  await expect(page.getByRole('button', { name: openName('WK-EARLY') })).toHaveCount(0);
  await page.getByRole('button', { name: 'Previous week', exact: true }).click();
  await page.getByRole('button', { name: openName('WK-EARLY') }).press('Enter');
  await expect(page.getByRole('dialog')).toContainText('WK-EARLY');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('button', { name: openName('WK-EARLY') })).toBeVisible();
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Viewings records', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: openName('WK-NEXT') })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'List', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
