import { expect, test } from './helpers/session.js';
import { saveRecordForm } from './helpers/record-form.js';
import { SEED_CRM } from '../../src/data/demo.js';

test('frontend navigation omits Calendar and makes no Calendar API requests', async ({ page }) => {
  const requests = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/calendar/')) requests.push(request.url());
  });
  await page.clock.install();
  await page.goto('/');
  await expect(page.locator('.page-heading h1')).toHaveText('Overview');
  await expect(page.locator('.sidebar .nav-item')).toHaveCount(19);
  await expect(page.locator('.sidebar .nav-item').filter({ hasText: /^Calendar$/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Manage viewings', exact: true }).click();
  await expect(page.locator('.page-heading h1')).toHaveText('Viewings & feedback');
  await page.goto('/#/calendar');
  await expect(page.locator('.page-heading h1')).toHaveText('Overview');
  await expect(page).toHaveURL(/\/#\/$/);
  await page.clock.fastForward(15000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  expect(requests).toEqual([]);
});

test('follow-ups and viewings retain local schedules without exposing Google controls', async ({
  page,
}) => {
  const data = SEED_CRM();
  data['Follow-ups'] = [
    {
      activity_id: 'FU-LOCAL-PRESERVE',
      next_action: 'Local meeting',
      due_date: '2026-10-09',
      task_status: 'Open',
      calendar_start: '2026-10-09T10:30',
      calendar_duration: '45',
      calendar_location: 'Marina office',
      calendar_activity: 'Meeting',
      calendar_enabled: 'Yes',
      calendar_invite: 'Yes',
      calendar_reminder: 'legacy value',
    },
  ];
  await page.addInitScript((data) => {
    if (!sessionStorage.getItem('kws-local-schedule-test-seeded')) {
      localStorage.setItem('kws-crm-v1:workspace:aidah', JSON.stringify({ data, demo: true }));
      sessionStorage.setItem('kws-local-schedule-test-seeded', 'true');
    }
  }, data);
  await page.goto('/#/follow-ups');
  await page.getByRole('button', { name: 'Open record FU-LOCAL-PRESERVE', exact: true }).click();
  const details = page.getByRole('dialog');
  const schedule = details.getByRole('region', { name: 'Activity schedule', exact: true });
  await expect(schedule).toContainText('10:30 AM');
  await expect(schedule).toContainText('Marina office');
  await expect(schedule).toContainText('45 minutes');
  await expect(details).not.toContainText(/Google|Pending connection|invitation/i);
  await details.getByRole('button', { name: 'Edit record', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.getByRole('button', { name: 'Step 2: Scheduling', exact: true }).click();
  for (const id of ['calendar_enabled', 'calendar_invite', 'calendar_reminder'])
    await expect(editor.locator(`#${id}`)).toHaveCount(0);
  await page.locator('#calendar_start').fill('2026-10-10T14:00');
  await page.locator('#calendar_location').fill('Downtown office');
  await saveRecordForm(page);
  await page.reload();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('kws-crm-v1:workspace:aidah')).data['Follow-ups'][0],
  );
  expect(saved).toMatchObject({
    calendar_start: '2026-10-10T14:00',
    due_date: '2026-10-10',
    calendar_location: 'Downtown office',
    calendar_enabled: 'Yes',
    calendar_invite: 'Yes',
    calendar_reminder: 'legacy value',
  });
  await page.goto('/#/viewings');
  await page.getByRole('button', { name: 'Add viewing', exact: true }).click();
  const viewingId = await page.locator('#viewing_id').inputValue();
  await page.getByRole('dialog').getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('#appointment_date_time')).toBeVisible();
  await page.locator('#appointment_date_time').fill('2026-10-11T11:30');
  await page.locator('#calendar_location').fill('Property lobby');
  await expect(page.getByRole('dialog')).not.toContainText(/Google|invitation|reminder/i);
  await saveRecordForm(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const viewing = await page.evaluate(
    (id) =>
      JSON.parse(localStorage.getItem('kws-crm-v1:workspace:aidah')).data.Viewings.find(
        (row) => row.viewing_id === id,
      ),
    viewingId,
  );
  expect(viewing).toMatchObject({
    appointment_date_time: '2026-10-11T11:30',
    calendar_location: 'Property lobby',
    calendar_enabled: 'No',
    calendar_invite: 'No',
  });
});
