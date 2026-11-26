import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { signIn } from './helpers/session.js';
import { saveRecordForm } from './helpers/record-form.js';
import {
  initialTeam,
  setupOwner,
  activateMember,
  inviteMember,
} from '../../src/features/team/model.js';
import { appendActivity } from '../../src/features/activity/model.js';
import { workspaceStorageKey, workspaceUrl } from '../../src/features/workspaces/model.js';
import { SUPER_WORKSPACE_ID } from '../../src/config/workspaces.js';
import { TEAM_STORAGE } from '../../src/config/team.js';
import { DEMO_PASSWORD } from '../../src/config/demoAccounts.js';
import { blank } from '../../src/lib/schema.js';

const password = { password: DEMO_PASSWORD, confirmPassword: DEMO_PASSWORD };
const ownerForm = {
  name: 'Simoni',
  email: 'simoni@keyswithsimoni.test',
  phone: '+971501234567',
  ...password,
};
function teamWithMembers(extra = 0) {
  let team = setupOwner(initialTeam(), ownerForm, 'simoni').team;
  team = activateMember(team, 'aidah', 1, { name: 'Aidah', phone: '+971501234568', ...password });
  for (let index = 0; index <= extra; index++) {
    const id = index ? `member-${index}` : 'brenda';
    const name = index ? `Member ${index}` : 'Brenda';
    team = inviteMember(
      team,
      'simoni',
      {
        name,
        email: `${id}@example.test`,
        roleId: 'admin',
        channelAccess: { email: true, whatsapp: true },
      },
      id,
    ).team;
    team = activateMember(team, id, 1, {
      name,
      phone: `+9715011111${String(index).padStart(2, '0')}`,
      ...password,
    });
  }
  return team;
}
function records(name) {
  const data = blank();
  data.Clients = [
    {
      client_id: 'CL-001',
      full_name: `${name} private client`,
      email: `${name.toLowerCase()}-client@example.test`,
      phone: '+971509876543',
    },
  ];
  data.Contacts = [
    {
      contact_id: 'CO-001',
      full_name: `${name} landlord`,
      contact_type: 'Landlord',
      email: `${name.toLowerCase()}-landlord@example.test`,
      phone: '+971508887777',
    },
  ];
  data.Properties = [
    { property_id: 'PR-001', listing_title: `${name} property`, contact_id: 'CO-001' },
  ];
  data['Follow-ups'] = [
    {
      activity_id: 'FU-001',
      client_id: 'CL-001',
      next_action: `${name} call`,
      due_date: '2026-10-09',
      task_status: 'Open',
    },
  ];
  return { data, demo: false };
}
async function seed(page, { extra = 0, history = false, malformed = false } = {}) {
  const team = teamWithMembers(extra);
  let aidah = records('Aidah');
  if (history)
    for (let index = 0; index < 8; index++)
      aidah = appendActivity(
        aidah,
        { id: 'aidah', name: 'Aidah' },
        'aidah',
        {
          action: 'create',
          module: 'Clients',
          recordId: `CL-HISTORY-${index}`,
          label: `Recorded client ${index}`,
        },
        { id: `event-${index}`, now: Date.parse('2026-10-09T06:00:00Z') + index * 1000 },
      );
  const entries = {
    [TEAM_STORAGE]: JSON.stringify(team),
    [workspaceStorageKey(SUPER_WORKSPACE_ID)]: JSON.stringify({
      ...records('Organisation'),
      customMetadata: { original: true },
    }),
    [workspaceStorageKey('aidah')]: JSON.stringify(aidah),
    [workspaceStorageKey('brenda')]: malformed
      ? '{unreadable-private-records'
      : JSON.stringify(records('Brenda')),
  };
  await page.addInitScript((entries) => {
    if (!sessionStorage.getItem('kws-workspace-test-seeded')) {
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
      sessionStorage.setItem('kws-workspace-test-seeded', 'true');
    }
    window.workspaceReads = [];
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key.startsWith('kws-crm-v1')) window.workspaceReads.push(key);
      return getItem.call(this, key);
    };
  }, entries);
  await page.goto('/#/sign-in');
  return entries;
}

test('Admins see only their own linked records, messaging directory, history and exports; forged workspace links are rejected', async ({
  page,
}) => {
  const original = await seed(page);
  await signIn(page);
  await page.getByRole('button', { name: 'Clients', exact: true }).click();
  await expect(page.getByText('Aidah private client', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Workspaces', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Messages', exact: true }).click();
  await page.getByRole('button', { name: 'Start email message', exact: true }).click();
  await page.getByRole('button', { name: 'Browse saved recipients', exact: true }).click();
  const directory = page.getByRole('region', { name: 'Saved recipients', exact: true });
  await expect(directory).toContainText('Aidah private client');
  await expect(directory).toContainText('Aidah landlord');
  await expect(directory).not.toContainText(/Brenda|Organisation/);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Data & export', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Full backup with photos (JSON)', exact: true }).click();
  const download = await downloading;
  const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(backup.data.Clients[0].full_name).toBe('Aidah private client');
  expect(JSON.stringify(backup)).not.toMatch(/Brenda|Organisation/);
  await page.getByRole('button', { name: 'Team activity', exact: true }).click();
  await expect(page.getByLabel('Workspace', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Member', { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      window.workspaceReads.some(
        (key) => key === 'kws-crm-v1' || key === 'kws-crm-v1:workspace:brenda',
      ),
    ),
  ).toBe(false);
  await page.goto(`/#${workspaceUrl('Clients', 'brenda')}`);
  await expect(
    page.getByRole('heading', { name: 'Workspace access is restricted', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.workspaceReads)).not.toContain(
    'kws-crm-v1:workspace:brenda',
  );
  await page.getByRole('link', { name: 'Return to my workspace', exact: true }).click();
  await page.goto('/#/sign-out');
  await signIn(page, { email: 'brenda@example.test' });
  await page.getByRole('button', { name: 'Clients', exact: true }).click();
  await expect(page.getByText('Brenda private client', { exact: true })).toBeVisible();
  await expect(page.getByText('Aidah private client', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('kws-crm-v1'))).toBe(
    original['kws-crm-v1'],
  );
});

test('Super Admin opens every workspace, preserves duplicate IDs across profiles and sees attributed changes after reload', async ({
  page,
}) => {
  const initial = await seed(page, { extra: 6, history: true });
  await signIn(page, ownerForm);
  await page.getByRole('button', { name: 'Clients', exact: true }).click();
  await expect(page.getByText('Organisation private client', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Switch workspace', exact: true }).click();
  await expect(
    page.getByRole('list', { name: 'Member workspaces', exact: true }).getByRole('listitem'),
  ).toHaveCount(10);
  await expect(page.getByRole('button', { name: /^More member workspaces/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Aidah workspace', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Current workspace', exact: true })).toContainText(
    'Aidah',
  );
  await page.getByRole('button', { name: 'Clients', exact: true }).click();
  await expect(page).toHaveURL(/clients\?workspace=aidah$/);
  await page.getByRole('button', { name: 'Open record CL-001', exact: true }).click();
  await page.getByRole('button', { name: 'Edit record', exact: true }).click();
  await page.locator('#full_name').fill('Aidah client updated by Simoni');
  await saveRecordForm(page);
  await page.reload();
  await expect(page.getByText('Aidah client updated by Simoni', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Team activity', exact: true }).click();
  await page.getByLabel('Workspace', { exact: true }).selectOption('aidah');
  await page.getByLabel('Member', { exact: true }).selectOption('simoni');
  const activity = page.getByRole('list', { name: 'Workspace activity', exact: true });
  await expect(activity).toContainText('Simoni');
  await expect(activity).toContainText('Aidah client updated by Simoni');
  await expect(activity).toContainText('Changed: Full name');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(activity.getByRole('listitem')).toHaveCount(9);
  await expect(page.getByRole('button', { name: /^More workspace activity/ })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('kws-crm-v1'))).toBe(initial['kws-crm-v1']);
  expect(await page.evaluate(() => localStorage.getItem('kws-crm-v1:workspace:brenda'))).toBe(
    initial['kws-crm-v1:workspace:brenda'],
  );
});

test('record creation, task completion, deletion and message previews produce scoped activity without persisting message content', async ({
  page,
}) => {
  await seed(page);
  await signIn(page);
  await page.goto('/#/clients');
  await page.getByRole('button', { name: 'Add client', exact: true }).click();
  await page.locator('#full_name').fill('Activity client');
  await saveRecordForm(page);
  await page.getByRole('button', { name: 'Open record CL-002', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.goto('/#/follow-ups');
  await page.getByRole('button', { name: 'Open record FU-001', exact: true }).click();
  await page.getByRole('button', { name: 'Edit record', exact: true }).click();
  await page.locator('#task_status').selectOption('Completed');
  await saveRecordForm(page);
  await page.goto('/#/messages');
  await page.getByRole('button', { name: 'Start email message', exact: true }).click();
  await page.getByLabel(/^Email recipients/).fill('private-recipient@example.test');
  await page.getByRole('dialog').getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByLabel(/^Subject/).fill('Private subject');
  await page.getByLabel(/^Message/).fill('Private message body');
  await page.getByRole('dialog').getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  await page.goto('/#/team-activity');
  const history = page.getByRole('list', { name: 'Workspace activity', exact: true });
  await expect(history).toContainText('Created record');
  await expect(history).toContainText('Deleted record');
  await expect(history).toContainText('Task status');
  await expect(history).toContainText('not sent');
  const events = await page.evaluate(
    () => JSON.parse(localStorage.getItem('kws-crm-v1:workspace:aidah')).activity,
  );
  expect(events).toHaveLength(4);
  expect(events.every((entry) => entry.actorId === 'aidah' && entry.workspaceId === 'aidah')).toBe(
    true,
  );
  expect(JSON.stringify(events)).not.toMatch(
    /private-recipient|Private subject|Private message body/,
  );
});

test('workspace switches guard unsaved forms and reset searches and selection when another profile opens', async ({
  page,
}) => {
  await seed(page);
  await signIn(page, ownerForm);
  await page.goto(`/#${workspaceUrl('Clients', 'aidah')}`);
  await page.getByRole('button', { name: 'Add client', exact: true }).click();
  await page.locator('#full_name').fill('Unsaved workspace client');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent === 'Switch workspace')
      .click(),
  );
  await expect(page.locator('#full_name')).toHaveValue('Unsaved workspace client');
  page.once('dialog', (dialog) => dialog.accept());
  await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent === 'Switch workspace')
      .click(),
  );
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Brenda workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Clients', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Search Clients', exact: true })).toHaveValue('');
  await expect(page.getByText('Brenda private client', { exact: true })).toBeVisible();
  await expect(page.getByText('Unsaved workspace client', { exact: true })).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole('region', { name: 'Current workspace', exact: true })).toContainText(
    'Brenda',
  );
});

test('workspace directory and scrollable activity fit mobile in both themes and preserve corrupt stores', async ({
  page,
}, testInfo) => {
  const initial = await seed(page, { extra: 6, history: true, malformed: true });
  await signIn(page, ownerForm);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/workspaces');
  for (const theme of ['dark', 'light']) {
    if (theme === 'light')
      await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
    await expect(page.getByRole('button', { name: /^More member workspaces/ })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath(`workspaces-mobile-${theme}.png`),
      fullPage: true,
    });
  }
  await page.goto('/#/team-activity');
  await expect(page.getByText(/1 workspace histories need recovery/)).toBeVisible();
  await page.getByLabel('From date', { exact: true }).fill('2026-10-10');
  await page.getByLabel('To date', { exact: true }).fill('2026-10-09');
  await expect(page.getByRole('alert')).toContainText('Choose an end date');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(
    page.getByRole('list', { name: 'Workspace activity', exact: true }).getByRole('listitem'),
  ).toHaveCount(8);
  await expect(page.getByRole('button', { name: /^More workspace activity/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('activity-mobile-light.png'), fullPage: true });
  await page.goto(`/#${workspaceUrl('Dashboard', 'brenda')}`);
  await expect(
    page.getByRole('heading', { name: 'Recover your workspace', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('kws-crm-v1:workspace:brenda'))).toBe(
    initial['kws-crm-v1:workspace:brenda'],
  );
  await page.getByRole('link', { name: 'Return to my workspace', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Workspace directory', exact: true }),
  ).toBeVisible();
});
