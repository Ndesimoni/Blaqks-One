// Retained integration scenarios for the future Calendar phase; outside the frontend suite.
import { expect, test } from '../browser/helpers/session.js';
import { saveRecordForm } from '../browser/helpers/record-form.js';

async function addMeeting(page, { invite = false } = {}) {
  await page.getByRole('button', { name: 'Schedule meeting', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName('New meeting');
  await page.locator('#client_id').selectOption('CL-001');
  await page.locator('#next_action').fill('Discuss Marina shortlist');
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  const day = (await page.locator('#calendar_start').inputValue()).slice(0, 10);
  await page.locator('#calendar_start').fill(`${day}T10:30`);
  await page.locator('#calendar_duration').fill('45');
  await page.locator('#calendar_reminder').fill('30');
  await page.locator('#calendar_location').fill('Marina office');
  if (invite) await page.locator('#calendar_invite').selectOption('Yes');
  await saveRecordForm(page);
  return day;
}

test('calendar works before Google setup, preserves schedules and fits mobile in both themes', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/calendar');
  await expect(
    page.getByRole('heading', { name: 'Calendar & appointments', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Connect Google Calendar', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('group', { name: 'Choose a date', exact: true }).getByRole('button'),
  ).toHaveCount(42);
  const day = await addMeeting(page);
  await expect(page.locator('.calendar-day.is-today .calendar-day-number')).not.toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
  const activity = page.getByRole('article', {
    name: 'Meeting: Discuss Marina shortlist',
    exact: true,
  });
  await expect(activity).toContainText('10:30 AM');
  await expect(activity).toContainText('Pending connection');
  const record = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kws-crm-v1')).data['Follow-ups'].find(
      (row) => row.next_action === 'Discuss Marina shortlist',
    ),
  );
  expect(record.calendar_start).toBe(`${day}T10:30`);
  expect(record.due_date).toBe(day);
  expect(record.calendar_invite).toBe('No');
  await page.reload();
  await expect(activity).toContainText('Marina office');
  await page.screenshot({ path: testInfo.outputPath('calendar-desktop-dark.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(
    page.getByRole('button', { name: 'Schedule meeting', exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('calendar-mobile-dark.png'), fullPage: true });
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('calendar-mobile-light.png'), fullPage: true });
  await page.getByRole('button', { name: `Edit ${record.activity_id}`, exact: true }).click();
  await expect(page.getByRole('dialog').locator('.form-progress')).toContainText(
    'Scheduling & Google Calendar',
  );
  await expect(page.locator('#calendar_start')).toHaveValue(`${day}T10:30`);
  await page.locator('#calendar_duration').fill('0');
  await page.getByRole('dialog').getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('#calendar_duration')).toHaveAttribute('aria-invalid', 'true');
  page.once('dialog', (dialog) => dialog.accept());
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Google sync publishes explicit invitations, reschedules, retries and cancels the linked activity', async ({
  page,
}) => {
  const status = {
    configured: true,
    connected: true,
    calendar: null,
    csrf: 'browser-test-csrf',
    revision: 0,
    items: {},
  };
  const snapshots = [];
  let fail = false;
  await page.route('**/api/calendar/**', async (route) => {
    const path = new URL(route.request().url()).pathname.split('/').at(-1);
    if (path === 'calendars')
      return route.fulfill({
        json: { calendars: [{ id: 'crm-calendar', summary: 'Keys with Simoni' }] },
      });
    if (path === 'selection') status.calendar = { id: 'crm-calendar', summary: 'Keys with Simoni' };
    if (path === 'snapshot') {
      const input = route.request().postDataJSON();
      expect(route.request().headers()['x-calendar-csrf']).toBe(status.csrf);
      snapshots.push(input);
      status.revision = input.revision;
      for (const key of Object.keys(status.items))
        if (!input.events.some((event) => event.key === key))
          status.items[key] = { state: 'cancelled' };
      for (const event of input.events)
        status.items[event.key] = fail
          ? {
              state: 'failed',
              error: 'Google is temporarily unavailable. The activity will retry.',
            }
          : { state: 'synced', url: 'https://calendar.google.com/calendar/event?eid=test' };
    }
    if (path === 'retry') {
      fail = false;
      for (const key of Object.keys(status.items))
        if (status.items[key].state === 'failed')
          status.items[key] = {
            state: 'synced',
            url: 'https://calendar.google.com/calendar/event?eid=test',
          };
    }
    if (path === 'disconnect') {
      status.connected = false;
      status.calendar = null;
    }
    return route.fulfill({ json: status });
  });
  await page.goto('/#/calendar');
  await expect(page.getByLabel('Choose a calendar', { exact: true })).toHaveValue('crm-calendar');
  await page.getByRole('button', { name: 'Use this calendar', exact: true }).click();
  await expect.poll(() => snapshots.length).toBeGreaterThan(0);
  expect(snapshots[0].events).toEqual([]); // sample records are not sent automatically
  const day = await addMeeting(page, { invite: true });
  const activity = page.getByRole('article', {
    name: 'Meeting: Discuss Marina shortlist',
    exact: true,
  });
  await expect(activity).toContainText('Synced');
  const first = snapshots.at(-1).events[0];
  expect(first.start.dateTime).toBe(`${day}T06:30:00.000Z`);
  expect(first.end.dateTime).toBe(`${day}T07:15:00.000Z`);
  expect(first.reminderMinutes).toBe(30);
  expect(first.attendees).toHaveLength(1);
  const id = first.key.split(':')[1];
  fail = true;
  await page.getByRole('button', { name: `Edit ${id}`, exact: true }).click();
  await page.locator('#calendar_start').fill(`${day}T16:00`);
  await saveRecordForm(page);
  await expect(activity).toContainText('Failed');
  expect(snapshots.at(-1).events[0].key).toBe(first.key);
  expect(snapshots.at(-1).events[0].start.dateTime).toBe(`${day}T12:00:00.000Z`);
  await page.getByRole('button', { name: 'Retry failed sync', exact: true }).click();
  await expect(activity).toContainText('Synced');
  await expect(
    activity.getByRole('link', { name: 'Open in Google Calendar', exact: true }),
  ).toHaveAttribute('target', '_blank');
  await page.getByRole('button', { name: `Edit ${id}`, exact: true }).click();
  await page.getByRole('button', { name: 'Step 1: Record information', exact: true }).click();
  await page.locator('#task_status').selectOption('Completed');
  await saveRecordForm(page);
  await expect(activity).toHaveCount(0);
  await expect.poll(() => snapshots.at(-1).events.length).toBe(0);
  await page.getByRole('checkbox', { name: 'Include completed / cancelled' }).check();
  await expect(activity).toContainText('Completed / cancelled');
  await page.getByRole('button', { name: `View ${id}`, exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(activity).toHaveCount(0);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Disconnect Google', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Connect Google Calendar', exact: true }),
  ).toBeEnabled();
});
