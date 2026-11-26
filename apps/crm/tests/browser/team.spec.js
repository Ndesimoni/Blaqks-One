import { test, expect } from '@playwright/test';
import { DEMO_PASSWORD } from '../../src/config/demoAccounts.js';
import { TEAM_STORAGE } from '../../src/config/team.js';
import {
  initialTeam,
  setupOwner,
  inviteMember,
  activateMember,
  previewLink,
} from '../../src/features/team/model.js';
import { signIn } from './helpers/session.js';
import { SEED_CRM } from '../../src/data/demo.js';

const ownerForm = {
  name: 'Aidah',
  email: 'aidah@keyswithsimoni.test',
  phone: '+971501234567',
  password: DEMO_PASSWORD,
  confirmPassword: DEMO_PASSWORD,
  whatsappUpdates: true,
};
const ownerTeam = () => setupOwner(initialTeam(), ownerForm, 'aidah').team;
function receptionistTeam() {
  let team = inviteMember(
    ownerTeam(),
    'aidah',
    {
      name: 'Nora Reception',
      email: 'nora@example.test',
      roleId: 'receptionist',
      channelAccess: { whatsapp: true, email: false },
    },
    'nora',
  ).team;
  return activateMember(team, 'nora', 1, {
    name: 'Nora Reception',
    email: 'nora@example.test',
    phone: '+971509876543',
    whatsappUpdates: true,
    password: DEMO_PASSWORD,
    confirmPassword: DEMO_PASSWORD,
  });
}
async function seedTeam(page, team) {
  await page.addInitScript(
    ({ key, team }) => {
      if (!sessionStorage.getItem('kws-team-test-seeded')) {
        localStorage.setItem(key, JSON.stringify(team));
        sessionStorage.setItem('kws-team-test-seeded', 'true');
      }
    },
    {
      key: TEAM_STORAGE,
      team,
    },
  );
}
async function passwordStep(page) {
  await page.getByLabel(/^Create password/).fill(DEMO_PASSWORD);
  await page.getByLabel(/^Confirm password/).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
}
async function openOwner(page, team = ownerTeam()) {
  await seedTeam(page, team);
  await page.goto('/#/sign-in');
  await signIn(page);
  await page.getByRole('button', { name: 'Team & access', exact: true }).click();
  await expect(page.locator('.page-heading h1')).toHaveText('Team & access');
}
async function noOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    width: window.innerWidth,
    scroll: document.documentElement.scrollWidth,
    wide: Array.from(document.querySelectorAll('main *'))
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 20)
      .map((element) => ({
        tag: element.tagName,
        class: element.className,
        right: element.getBoundingClientRect().right,
        width: element.getBoundingClientRect().width,
      })),
  }));
  expect(dimensions.scroll, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.width + 1);
}

test('Super Admin setup requires phone and preserves existing CRM data without saving passwords', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/sign-in');
  await signIn(page);
  const before = await page.evaluate(() => localStorage.getItem('kws-crm-v1:workspace:aidah'));
  await page.getByRole('button', { name: 'Team & access', exact: true }).click();
  await page.getByRole('link', { name: 'Set up Super Admin', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Set up your workspace', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByLabel(/^Phone number/)).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel(/^Phone number/).fill('0501234567');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText(/Enter a phone number with its country code/)).toBeVisible();
  await page.getByLabel(/^Phone number/).fill('+971 50 123 4567');
  await page.getByRole('checkbox', { name: /Receive work updates/ }).check();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await passwordStep(page);
  await page.screenshot({
    animations: 'disabled',
    path: 'test-results/team-owner-review-desktop.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Create workspace preview', exact: true }).click();
  await expect(page.locator('.page-heading h1')).toHaveText('Team & access');
  await expect(page.locator('.team-table')).toContainText('Super Admin');
  const saved = await page.evaluate(
    ({ key }) => ({
      raw: localStorage.getItem(key),
      crm: localStorage.getItem('kws-crm-v1:workspace:aidah'),
      session: sessionStorage.getItem('kws-crm-demo-session'),
    }),
    { key: TEAM_STORAGE },
  );
  const team = JSON.parse(saved.raw);
  expect(team.members.filter((member) => member.roleId === 'super-admin')).toHaveLength(1);
  expect(team.members[0].phone).toBe('+971501234567');
  expect(saved.raw).not.toContain(DEMO_PASSWORD);
  expect(saved.crm).toBe(before);
  expect(JSON.parse(saved.session)).toEqual({ version: 1, adminId: 'aidah' });
  await page.reload();
  await expect(page.locator('.team-table')).toContainText('Super Admin');
  await page.screenshot({
    animations: 'disabled',
    path: 'test-results/team-directory-desktop.png',
    fullPage: true,
  });
  await page.goto('/#/setup-preview');
  await expect(
    page.getByRole('heading', { name: 'The Super Admin is already set up' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('invitation activation requires member phone and respects CRM and client-channel permissions', async ({
  page,
}) => {
  const outbound = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:5174/'))
      outbound.push(request.url());
  });
  await openOwner(page);
  await page.getByRole('button', { name: 'Invite member', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Invite team member', exact: true });
  await dialog.getByLabel(/^Full name/).fill('Nora Reception');
  await dialog.getByLabel(/^Email address/).fill('nora@example.test');
  await expect(dialog.getByLabel(/^Phone number/)).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await dialog.getByLabel('Assigned role', { exact: true }).selectOption('receptionist');
  await dialog.getByRole('checkbox', { name: /Send WhatsApp messages to clients/ }).check();
  await expect(dialog.getByRole('checkbox', { name: /Send emails to clients/ })).not.toBeChecked();
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await dialog.getByRole('button', { name: 'Create invitation preview', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Invitation preview', exact: true })).toBeVisible();
  const link = await page.getByLabel('Preview link', { exact: true }).inputValue();
  await page.getByRole('link', { name: 'Open preview', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByLabel(/^Phone number/)).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel(/^Phone number/).fill('+971 50 987 6543');
  await page.getByRole('checkbox', { name: /Receive work updates/ }).check();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await passwordStep(page);
  await page.getByRole('button', { name: 'Activate & open dashboard', exact: true }).click();
  await expect(page.locator('.page-heading h1')).toHaveText('Overview');
  await expect(page.getByRole('heading', { name: 'Welcome, Nora Reception' })).toBeVisible();
  await expect(page.locator('.sidebar .nav-item').filter({ hasText: /^Properties$/ })).toHaveCount(
    0,
  );
  await expect(page.locator('.sidebar .nav-item').filter({ hasText: /^Deals$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Data & export', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Team & access', exact: true })).toHaveCount(0);
  // The receptionist now operates on personal records rather than the owner's shared demo.
  await page.evaluate((data) => {
    const id = JSON.parse(sessionStorage.getItem('kws-crm-demo-session')).adminId;
    localStorage.setItem(
      `kws-crm-v1:workspace:${encodeURIComponent(id)}`,
      JSON.stringify({ data, demo: true }),
    );
  }, SEED_CRM());
  await page.reload();
  await page.goto('/#/deals');
  await expect(
    page.getByRole('heading', { name: 'This section is outside your assigned access' }),
  ).toBeVisible();
  await page.goto('/#/client-desk');
  await expect(
    page.getByRole('button', { name: 'Preview WhatsApp message', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Preview client email', exact: true }),
  ).toBeDisabled();
  await expect(page.getByText('Curated property matches', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Preview WhatsApp message', exact: true }).click();
  await page.getByLabel(/^Message/).fill('Your viewing is scheduled for tomorrow.');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('PREVIEW ONLY · NOT SENT', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'This link is unavailable' })).toBeVisible();
  expect(outbound).toEqual([]);
});

test('own profile changes verify email before changing login and reset previews consume their links', async ({
  page,
}) => {
  await seedTeam(page, receptionistTeam());
  await page.goto('/#/sign-in');
  await signIn(page, { email: 'nora@example.test' });
  await page.getByRole('button', { name: 'My profile', exact: true }).click();
  await page.getByRole('button', { name: 'Edit my profile', exact: true }).click();
  await page.getByLabel(/^Email address/).fill('nora.new@example.test');
  await page.getByLabel(/^Phone number/).fill('+971501112222');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByLabel('Assigned role', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save member', exact: true }).click();
  await expect(page.getByText('New email awaiting verification', { exact: true })).toBeVisible();
  await expect(page.locator('.profile-settings-details')).toContainText('nora@example.test');
  await page.getByRole('button', { name: 'Preview email verification', exact: true }).click();
  await page.getByRole('link', { name: 'Open preview', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm email preview', exact: true }).click();
  await expect(page.locator('.page-heading h1')).toHaveText('My profile & messaging');
  await expect(page.locator('.profile-settings-details')).toContainText('nora.new@example.test');
  await expect(page.getByText('New email awaiting verification', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Preview password reset', exact: true }).click();
  const reset = await page.getByLabel('Preview link', { exact: true }).inputValue();
  await page.getByRole('link', { name: 'Open preview', exact: true }).click();
  await passwordStep(page);
  await page.getByRole('button', { name: 'Complete reset preview', exact: true }).click();
  await expect(page.locator('.page-heading h1')).toHaveText('Overview');
  await page.goto(reset);
  await expect(page.getByRole('heading', { name: 'This link is unavailable' })).toBeVisible();
  const team = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), TEAM_STORAGE);
  expect(team.members.find((member) => member.id === 'nora').roleId).toBe('receptionist');
  expect(JSON.stringify(team)).not.toContain(DEMO_PASSWORD);
  await page.goto('/#/sign-out');
  await signIn(page, { email: 'nora.new@example.test' });
});

test('owner creates custom roles, edits member access, suspends access and previews staff updates', async ({
  page,
}) => {
  await openOwner(page, receptionistTeam());
  await page.getByRole('button', { name: 'Roles & permissions', exact: true }).click();
  await page.getByRole('button', { name: 'Create role', exact: true }).click();
  await page.getByLabel(/^Role name/).fill('Client assistant');
  await page.getByLabel('Description', { exact: true }).fill('Relationships and appointments');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('checkbox', { name: /Properties & shortlists/ }).uncheck();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Create custom role' })
    .getByRole('button', { name: 'Create role', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Client assistant', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Members', exact: true }).click();
  await page.getByRole('button', { name: 'Manage Nora Reception', exact: true }).click();
  await page.getByRole('button', { name: 'Edit profile & access', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page
    .getByLabel('Assigned role', { exact: true })
    .selectOption({ label: 'Client assistant' });
  await page.getByRole('checkbox', { name: /Send emails to clients/ }).check();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Save member', exact: true }).click();
  await expect(
    page.locator('.team-table').getByRole('row').filter({ hasText: 'Nora Reception' }),
  ).toContainText('Client assistant');
  await page.getByRole('button', { name: 'Manage Nora Reception', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Suspend access', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Restore access', exact: true })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Restore access', exact: true }).click();
  await page.getByRole('button', { name: 'Preview staff WhatsApp', exact: true }).click();
  await page.getByLabel(/^Message/).fill('Please confirm tomorrow’s viewing with the client.');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('PREVIEW ONLY · NOT SENT', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  await page.getByRole('button', { name: 'Roles & permissions', exact: true }).click();
  const role = page
    .locator('.team-role-card')
    .filter({ has: page.getByRole('heading', { name: 'Client assistant', exact: true }) });
  page.once('dialog', (dialog) => dialog.accept());
  await role.getByRole('button', { name: 'Remove role', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Assign another role');
  await expect(role).toBeVisible();
});

test('client email preview uses member address and requires a sender connection without sending', async ({
  page,
}) => {
  await openOwner(page);
  await page.goto('/#/client-desk');
  await page.getByRole('button', { name: 'Preview client email', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Client email preview', exact: true }),
  ).toContainText('aidah@keyswithsimoni.test');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByLabel(/^Subject/)).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel(/^Subject/).fill('Your viewing details');
  await page.getByLabel(/^Message/).fill('I will meet you at the property entrance tomorrow.');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('PREVIEW ONLY · NOT SENT', { exact: true })).toBeVisible();
  await expect(page.locator('.message-preview')).toContainText('Connection required');
  await page.screenshot({
    animations: 'disabled',
    path: 'test-results/team-email-preview-desktop.png',
  });
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  await page.goto('/#/my-profile');
  await expect(page.getByText('Not connected', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'How sender connection works', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Connect your sender accounts' })).toContainText(
    'authorize your own supported mailbox',
  );
});

test('ownership transfer updates the session and leaves exactly one Super Admin', async ({
  page,
}) => {
  await openOwner(page, receptionistTeam());
  await page.getByRole('button', { name: 'Transfer ownership', exact: true }).click();
  await page.getByLabel('New Super Admin', { exact: true }).selectOption('nora');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Confirm transfer', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'This section is outside your assigned access' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Team & access', exact: true })).toHaveCount(0);
  const team = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), TEAM_STORAGE);
  expect(
    team.members.filter((member) => member.roleId === 'super-admin').map((member) => member.id),
  ).toEqual(['nora']);
  expect(team.members.find((member) => member.id === 'aidah').roleId).toBe('admin');
});

test('team write failures preserve previous details and malformed saved previews can be recovered', async ({
  page,
}) => {
  await openOwner(page);
  const before = await page.evaluate((key) => localStorage.getItem(key), TEAM_STORAGE);
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    window.restoreTeamWrites = () => {
      Storage.prototype.setItem = original;
    };
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Quota', 'QuotaExceededError');
      return original.call(this, name, value);
    };
  }, TEAM_STORAGE);
  await page.getByRole('button', { name: 'Invite member', exact: true }).click();
  await page.getByLabel(/^Full name/).fill('Unstored Member');
  await page.getByLabel(/^Email address/).fill('unstored@example.test');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Create invitation preview', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('previous team details are unchanged');
  expect(await page.evaluate((key) => localStorage.getItem(key), TEAM_STORAGE)).toBe(before);
  await expect(page.getByRole('dialog', { name: 'Invitation preview', exact: true })).toHaveCount(
    0,
  );
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  // Cross-tab corruption is handled without replacing the original stored text.
  await page.evaluate((key) => {
    window.restoreTeamWrites();
    localStorage.setItem(key, '{broken-team');
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: '{broken-team' }));
  }, TEAM_STORAGE);
  await expect(page.getByRole('heading', { name: 'Recover your team preview' })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), TEAM_STORAGE)).toBe(
    '{broken-team',
  );
  await expect(
    page.getByRole('button', { name: 'Download saved team data', exact: true }),
  ).toBeVisible();
});

test('mobile setup, team directory and modal wizard fit both themes with visible controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/setup-preview');
  await page.getByLabel(/^Full name/).fill('Aidah');
  await page.getByLabel(/^Email address/).fill('aidah@keyswithsimoni.test');
  await page.getByLabel(/^Phone number/).fill('+971501234567');
  await noOverflow(page);
  await page.screenshot({
    animations: 'disabled',
    path: 'test-results/team-setup-mobile-dark.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  await noOverflow(page);
  await page.screenshot({
    animations: 'disabled',
    path: 'test-results/team-setup-mobile-light.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await passwordStep(page);
  await page.getByRole('button', { name: 'Create workspace preview', exact: true }).click();
  await expect(page.locator('.page-heading h1')).toHaveText('Team & access');
  await noOverflow(page);
  await page.screenshot({
    animations: 'disabled',
    path: 'test-results/team-directory-mobile-light.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Invite member', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Invite team member' })).toBeVisible();
  await page.getByLabel(/^Full name/).fill('Mobile Member');
  await page.getByLabel(/^Email address/).fill('mobile@example.test');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await noOverflow(page);
  await page.screenshot({
    animations: 'disabled',
    path: 'test-results/team-invite-mobile-light.png',
  });
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeInViewport();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
});
