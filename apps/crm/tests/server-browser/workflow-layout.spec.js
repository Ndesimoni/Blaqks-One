import { expect, test } from './fixtures.js';
import { add } from '../api/assignment-helpers.mjs';
import { login } from '../api/helpers.mjs';
import { signIn } from './helpers.js';

test('workflow cards retain task dates, state and linked records in both themes', async ({
  page,
}, testInfo) => {
  const admin = await login();
  await add(admin, 'Clients', { client_id: 'UI5-CLIENT', full_name: 'Synthetic workflow client' });
  await add(admin, 'Properties', {
    property_id: 'UI5-PROPERTY',
    listing_title: 'Synthetic workflow listing',
  });
  const scenarios = [
    [
      'Follow-ups',
      'follow-ups',
      {
        activity_id: 'UI5-TASK',
        next_action: 'Call about viewing',
        due_date: '2020-01-01',
        task_status: 'Open',
      },
      'Due date',
    ],
    [
      'Viewings',
      'viewings',
      {
        viewing_id: 'UI5-VIEW',
        appointment_date_time: '2099-01-02 10:00',
        viewing_status: 'Scheduled',
      },
      'Appointment date & time',
    ],
    [
      'Shortlist',
      'shortlist',
      { match_id: 'UI5-MATCH', date_sent: '2020-01-01', client_response: 'Pending' },
      'Date sent',
    ],
    [
      'Interaction log',
      'interaction-log',
      {
        log_id: 'UI5-LOG',
        conversation_topic: 'Viewing requirements',
        contacted_on_uae_time: '2020-01-01 10:00',
        action_due: '2020-01-02',
        action_status: 'Open',
      },
      'Action due',
    ],
    [
      'Client care',
      'client-care',
      {
        care_id: 'UI5-CARE',
        touchpoint_type: 'Check-in',
        next_contact: '2020-01-02',
        task_status: 'Open',
      },
      'Next contact',
    ],
  ];
  for (const [module, , record] of scenarios) {
    await add(admin, module, {
      ...record,
      client_id: 'UI5-CLIENT',
      property_id: 'UI5-PROPERTY',
      property_id_optional: 'UI5-PROPERTY',
    });
  }
  await signIn(page);
  for (const [module, route, , dateLabel] of scenarios) {
    await page.goto(`/#/${route}`);
    await page.getByLabel(`Search ${module}`, { exact: true }).fill('UI5-');
    for (const theme of ['dark', 'light']) {
      await page.evaluate(
        (value) => document.documentElement.setAttribute('data-theme', value),
        theme,
      );
      await page.setViewportSize({ width: 390, height: 844 });
      const card = page.locator('.record-card').first();
      await expect(card).toContainText(dateLabel);
      await expect(card).toContainText('Synthetic workflow');
      await expect(card.getByRole('button', { name: /^Open record/ })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${route}-390-${theme}.png`) });
      await page.setViewportSize({ width: 1280, height: 900 });
      await expect(
        page.getByRole('table', { name: `${module} records`, exact: true }),
      ).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${route}-1280-${theme}.png`) });
    }
  }
});
