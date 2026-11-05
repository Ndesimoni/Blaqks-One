import { test, expect } from '@playwright/test';
import { signIn } from './helpers/session.js';
import { SEED_CRM } from '../../src/data/demo.js';
import { DEMO_PASSWORD } from '../../src/config/demoAccounts.js';
import { TEAM_STORAGE } from '../../src/config/team.js';
import {
  initialTeam,
  setupOwner,
  inviteMember,
  activateMember,
  normalizePhone,
} from '../../src/features/team/model.js';

const client = SEED_CRM().Clients[0];
async function open(page, path = '/messages') {
  await page.goto('/#/sign-in');
  await signIn(page);
  await page.goto(`/#${path}`);
}
async function next(page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Next', exact: true }).click();
}
async function choose(page, channel) {
  await page
    .getByRole('dialog')
    .getByRole('radio', { name: channel === 'email' ? /^Email/ : /^WhatsApp/ })
    .check();
}
async function close(page) {
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Close preview', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
}

test('Messages accepts bulk email recipients, preserves channel drafts and previews without sending or changing CRM records', async ({
  page,
}, testInfo) => {
  const errors = [],
    deliveries = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.method() !== 'GET' && /messages|send|gmail|whatsapp/i.test(request.url()))
      deliveries.push(request.url());
  });
  await open(page);
  await expect(page.locator('.page-heading h1')).toHaveText('Messages');
  const before = await page.evaluate(() => localStorage.getItem('kws-crm-v1:workspace:aidah'));
  await page.screenshot({
    path: testInfo.outputPath('messages-desktop-dark.png'),
    animations: 'disabled',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Start email message', exact: true }).click();
  await page
    .getByLabel(/^Email recipients/)
    .fill('first@example.test,SECOND@example.test;\nfirst@example.test');
  await expect(
    page.getByText('2 unique recipients · 1 duplicate ignored', { exact: true }),
  ).toBeVisible();
  await next(page);
  await next(page);
  await expect(page.getByLabel(/^Subject/)).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel(/^Subject/).fill('Your viewing details');
  await page.getByLabel(/^Message/).fill('Please confirm your viewing. <script>example</script>');
  await next(page);
  await expect(
    page.getByRole('list', { name: 'Reviewed recipients' }).getByRole('listitem'),
  ).toHaveText(['first@example.test', 'second@example.test']);
  await expect(page.locator('.message-preview')).toContainText('Individual delivery planned');
  await expect(page.locator('.message-preview')).toContainText('aidah@keyswithsimoni.test');
  await expect(page.locator('.message-preview script')).toHaveCount(0);
  await page.getByRole('button', { name: 'Step 1: Channel & recipients', exact: true }).click();
  await choose(page, 'whatsapp');
  await expect(page.getByLabel(/^WhatsApp recipients/)).toHaveValue('');
  await page.getByLabel(/^WhatsApp recipients/).fill('+971501112222');
  await choose(page, 'email');
  await expect(page.getByLabel(/^Email recipients/)).toHaveValue(
    'first@example.test,SECOND@example.test;\nfirst@example.test',
  );
  await next(page);
  await expect(page.getByLabel(/^Subject/)).toHaveValue('Your viewing details');
  await expect(page.getByLabel(/^Message/)).toHaveValue(
    'Please confirm your viewing. <script>example</script>',
  );
  await next(page);
  await page.screenshot({
    path: testInfo.outputPath('bulk-email-review-desktop.png'),
    animations: 'disabled',
  });
  await close(page);
  await expect(
    page.getByRole('status').filter({ hasText: 'Message preview closed. No messages were sent.' }),
  ).toBeVisible();
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kws-crm-v1:workspace:aidah')),
  );
  expect(after.data).toEqual(JSON.parse(before).data);
  expect(after.activity[0]).toMatchObject({
    action: 'message-preview',
    actorId: 'aidah',
    workspaceId: 'aidah',
  });
  expect(JSON.stringify(after.activity)).not.toContain('first@example.test');
  expect(deliveries).toEqual([]);
  expect(errors).toEqual([]);
});

test('WhatsApp batches validate each number, remove duplicates and add saved clients', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Start WhatsApp message', exact: true }).click();
  await page
    .getByLabel(/^WhatsApp recipients/)
    .fill('+971 (50) 111-2222,00971501112222\n0501234567');
  await next(page);
  await expect(page.getByLabel(/^WhatsApp recipients/)).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(/Include the country code for every number/)).toBeVisible();
  await page.getByLabel(/^WhatsApp recipients/).fill('+971 (50) 111-2222,00971501112222');
  await page.getByLabel('Search recipients', { exact: true }).fill(client.full_name);
  const result = page
    .getByRole('list', { name: 'Matching recipients' })
    .getByRole('listitem')
    .filter({ hasText: client.full_name });
  await result.getByRole('button', { name: /^Add / }).click();
  await expect(result.getByRole('button', { name: /^Added / })).toBeDisabled();
  await expect(
    page.getByText('2 unique recipients · 1 duplicate ignored', { exact: true }),
  ).toBeVisible();
  await next(page);
  await expect(page.getByLabel(/^Subject/)).toHaveCount(0);
  await page
    .getByLabel(/^Message/)
    .fill('New listings are available. Let us know your preferred viewing time.');
  await next(page);
  await expect(
    page.getByRole('list', { name: 'Reviewed recipients' }).getByRole('listitem'),
  ).toHaveText(['+971501112222', normalizePhone(client.phone)]);
  await expect(page.getByText('PREVIEW ONLY · NOT SENT', { exact: true })).toBeVisible();
  await close(page);
});

test('recipient picker filters saved people, deduplicates across categories and preserves manual entry when removing chips', async ({
  page,
}, testInfo) => {
  const data = SEED_CRM();
  data.Contacts.push({
    contact_id: 'CT-SHARED',
    full_name: client.full_name,
    contact_type: 'Landlord',
    email: client.email.toUpperCase(),
    phone: normalizePhone(client.phone),
  });
  await page.addInitScript(
    (data) =>
      localStorage.setItem('kws-crm-v1:workspace:aidah', JSON.stringify({ data, demo: true })),
    data,
  );
  await open(page);
  const before = await page.evaluate(() => localStorage.getItem('kws-crm-v1:workspace:aidah'));
  await page.getByRole('button', { name: 'Start email message', exact: true }).click();
  const picker = page.getByRole('region', { name: 'Saved recipients' });
  const recipients = page.getByLabel(/^Email recipients/);
  const chips = page.getByRole('list', { name: 'Selected recipients' });
  await expect(picker).toHaveCount(0);
  await recipients.click();
  await expect(picker).toBeVisible();
  await expect(recipients).toBeFocused();
  await recipients.press('Escape');
  await expect(picker).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Browse saved recipients', exact: true }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Browse saved recipients', exact: true }).click();
  const search = page.getByLabel('Search recipients', { exact: true });
  await expect(search).toBeFocused();
  await search.fill(client.full_name);
  await search.press('Enter');
  await expect(search).toBeVisible();
  await picker.getByRole('button', { name: 'Clients', exact: true }).click();
  await picker
    .getByRole('button', { name: `Add ${client.full_name}: ${client.email}`, exact: true })
    .click();
  await expect(chips.getByRole('listitem')).toHaveCount(1);
  for (const category of ['Leads', 'Landlords']) {
    await picker.getByRole('button', { name: category, exact: true }).click();
    await expect(
      picker.getByRole('button', {
        name: `Added ${client.full_name}: ${client.email}`,
        exact: true,
      }),
    ).toBeDisabled();
    await expect(chips.getByRole('listitem')).toHaveCount(1);
  }
  await search.fill('maya');
  await picker
    .getByRole('button', { name: 'Add Maya Properties: maya@example.com', exact: true })
    .click();
  await expect(chips.getByRole('listitem')).toHaveCount(2);
  await page.screenshot({
    path: testInfo.outputPath('recipient-picker-desktop-dark.png'),
    animations: 'disabled',
  });
  await recipients.fill(
    `manual@example.test; bad address; ${client.email.toUpperCase()}; ${client.email}; maya@example.com`,
  );
  await page.getByRole('button', { name: 'Remove maya@example.com', exact: true }).click();
  await expect(recipients).toHaveValue(
    `manual@example.test\nbad address\n${client.email.toUpperCase()}\n${client.email}`,
  );
  await page.getByRole('button', { name: `Remove ${client.email}`, exact: true }).click();
  await expect(recipients).toHaveValue('manual@example.test\nbad address');
  await expect(chips.getByRole('listitem')).toHaveCount(1);
  await next(page);
  await expect(recipients).toHaveAttribute('aria-invalid', 'true');
  await recipients.fill('manual@example.test');
  await next(page);
  await page.getByLabel(/^Subject/).fill('Recipient selection');
  await page.getByLabel(/^Message/).fill('The saved and manual recipient lists remain editable.');
  await next(page);
  await expect(
    page.getByRole('list', { name: 'Reviewed recipients' }).getByRole('listitem'),
  ).toHaveText(['manual@example.test']);
  await close(page);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('kws-crm-v1:workspace:aidah')).data),
  ).toEqual(JSON.parse(before).data);
});

test('recipient directory exposes all results, labels missing details and enforces the batch limit', async ({
  page,
}) => {
  const data = SEED_CRM();
  data.Contacts = [
    ...Array.from({ length: 14 }, (_, index) => ({
      contact_id: `CT-${index}`,
      full_name: `Landlord ${String(index).padStart(2, '0')}`,
      contact_type: 'Landlord',
      email: `landlord-${index}@example.test`,
      phone: `+97150000${String(index).padStart(4, '0')}`,
    })),
    { contact_id: 'CT-MISSING', full_name: 'Missing Details', contact_type: 'Landlord' },
    {
      contact_id: 'CT-INVALID',
      full_name: 'Invalid Details',
      contact_type: 'Landlord',
      email: 'invalid',
      phone: '0501234567',
    },
    {
      contact_id: 'CT-CLIENT',
      full_name: 'Contact Client',
      contact_type: 'Client',
      email: 'contact-client@example.test',
    },
  ];
  await page.addInitScript(
    (data) =>
      localStorage.setItem('kws-crm-v1:workspace:aidah', JSON.stringify({ data, demo: true })),
    data,
  );
  await open(page);
  await page.getByRole('button', { name: 'Start email message', exact: true }).click();
  await page.getByRole('button', { name: 'Browse saved recipients', exact: true }).click();
  const picker = page.getByRole('region', { name: 'Saved recipients' });
  const results = picker.getByRole('list', { name: 'Matching recipients', exact: true });
  const search = page.getByLabel('Search recipients', { exact: true });
  await picker.getByRole('button', { name: 'Landlords', exact: true }).click();
  await expect(
    picker.getByText('16 matches · Showing email addresses', { exact: true }),
  ).toBeVisible();
  await expect(results.getByRole('listitem')).toHaveCount(16);
  await expect(picker.getByRole('button', { name: /^More matching recipients/ })).toHaveCount(0);
  const allResults = results;
  await expect(
    allResults.getByRole('button', { name: 'Add Missing Details: No email recorded', exact: true }),
  ).toBeDisabled();
  await expect(
    allResults.getByRole('button', {
      name: 'Add Invalid Details: Check saved email: invalid',
      exact: true,
    }),
  ).toBeDisabled();
  await search.fill('no-such-person');
  await expect(picker.getByText(/No matching recipients/)).toBeVisible();
  await expect(results).toHaveCount(0);
  await search.fill('contact-client');
  await expect(results).toHaveCount(0);
  await picker.getByRole('button', { name: 'Clients', exact: true }).click();
  await picker
    .getByRole('button', { name: 'Add Contact Client: contact-client@example.test', exact: true })
    .click();
  await page.getByRole('button', { name: 'Close recipient picker', exact: true }).click();
  await expect(picker).toHaveCount(0);
  await page
    .getByLabel(/^Email recipients/)
    .fill(Array.from({ length: 100 }, (_, index) => `manual-${index}@example.test`).join('\n'));
  await picker.getByRole('button', { name: 'Landlords', exact: true }).click();
  await page.getByLabel('Search recipients', { exact: true }).fill('landlord-13@');
  const add = picker.getByRole('button', {
    name: 'Add Landlord 13: landlord-13@example.test',
    exact: true,
  });
  await expect(add).toBeDisabled();
  await page.getByRole('button', { name: 'Remove manual-0@example.test', exact: true }).click();
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.getByText('100 unique recipients', { exact: true })).toBeVisible();
  await choose(page, 'whatsapp');
  await page.getByLabel(/^WhatsApp recipients/).click();
  const phoneSearch = page.getByLabel('Search recipients', { exact: true });
  await phoneSearch.fill('+971 50 000 0013');
  await picker.getByRole('button', { name: 'Landlords', exact: true }).click();
  await picker.getByRole('button', { name: 'Add Landlord 13: +971500000013', exact: true }).click();
  await expect(page.getByLabel(/^WhatsApp recipients/)).toHaveValue('+971500000013');
  await phoneSearch.fill('missing');
  await expect(
    picker.getByRole('button', { name: 'Add Missing Details: No phone recorded', exact: true }),
  ).toBeDisabled();
  await phoneSearch.fill('invalid');
  await expect(
    picker.getByRole('button', {
      name: 'Add Invalid Details: Check saved phone: 0501234567',
      exact: true,
    }),
  ).toBeDisabled();
  await choose(page, 'email');
  await expect(page.getByLabel(/^Email recipients/)).toHaveValue(/landlord-13@example.test/);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
});

test('each client and lead offers a message action with editable prefilled contacts and a single modal', async ({
  page,
}) => {
  await open(page, '/clients');
  await page
    .getByRole('button', { name: `Start message with ${client.full_name}`, exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByRole('dialog')).toHaveAccessibleName(
    `Start message with ${client.full_name}`,
  );
  await expect(page.getByLabel(/^WhatsApp recipients/)).toHaveValue(client.phone);
  await choose(page, 'email');
  await expect(page.getByLabel(/^Email recipients/)).toHaveValue(client.email);
  await page.getByLabel(/^Email recipients/).fill('another@example.test');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: `Start message with ${client.full_name}`, exact: true }),
  ).toBeFocused();
  await page.getByRole('button', { name: `Open record ${client.client_id}`, exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Start message', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByLabel(/^WhatsApp recipients/)).toHaveValue(client.phone);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.goto('/#/leads');
  await page
    .getByRole('button', { name: `Start message with ${client.full_name}`, exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName(
    `Start message with ${client.full_name}`,
  );
  await expect(page.getByLabel(/^WhatsApp recipients/)).toHaveValue(client.phone);
});

test('Client desk starts a channel-selectable message and protects a draft during navigation', async ({
  page,
}) => {
  await open(page, '/client-desk');
  const before = await page.evaluate(() => localStorage.getItem('kws-crm-v1:workspace:aidah'));
  await page.getByRole('button', { name: 'Start message', exact: true }).click();
  await choose(page, 'email');
  await expect(page.getByLabel(/^Email recipients/)).toHaveValue(client.email);
  await next(page);
  await page.getByLabel(/^Subject/).fill('Client conversation');
  await page.getByLabel(/^Message/).fill('An unsaved client conversation.');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.evaluate(() => document.querySelector('.sidebar .nav-item').click());
  await expect(page.getByLabel(/^Message/)).toHaveValue('An unsaved client conversation.');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.goto('/#/messages');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('kws-crm-v1:workspace:aidah'))).toBe(
    before,
  );
});

test('assigned messaging permission disables denied channels and preselects an allowed channel', async ({
  page,
}) => {
  const password = { password: DEMO_PASSWORD, confirmPassword: DEMO_PASSWORD };
  let team = setupOwner(
    initialTeam(),
    { name: 'Aidah', email: 'aidah@keyswithsimoni.test', phone: '+971501234567', ...password },
    'aidah',
  ).team;
  team = inviteMember(
    team,
    'aidah',
    {
      name: 'Email Reception',
      email: 'reception@example.test',
      roleId: 'receptionist',
      channelAccess: { email: true, whatsapp: false },
    },
    'reception',
  ).team;
  team = activateMember(team, 'reception', 1, {
    name: 'Email Reception',
    phone: '+971509876543',
    ...password,
  });
  await page.addInitScript(
    (data) =>
      localStorage.setItem('kws-crm-v1:workspace:reception', JSON.stringify({ data, demo: true })),
    SEED_CRM(),
  );
  await page.addInitScript(({ key, team }) => localStorage.setItem(key, JSON.stringify(team)), {
    key: TEAM_STORAGE,
    team,
  });
  await page.goto('/#/sign-in');
  await signIn(page, { email: 'reception@example.test' });
  await page.goto('/#/messages');
  await expect(
    page.getByRole('button', { name: 'Start WhatsApp message', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Start a message', exact: true }).click();
  await expect(page.getByRole('radio', { name: /^Email/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: /^WhatsApp/ })).toBeDisabled();
  await page.getByLabel(/^Email recipients/).fill('client@example.test');
  await expect(page.getByRole('region', { name: 'Saved recipients' })).toBeVisible();
  // Directory access remains independent of the permitted messaging channel.
  await page.evaluate((key) => {
    const team = JSON.parse(localStorage.getItem(key));
    const receptionist = team.roles.find((role) => role.id === 'receptionist');
    team.roles.push({
      ...receptionist,
      id: 'messaging-only',
      name: 'Messaging only',
      builtIn: false,
      permissions: { ...receptionist.permissions, relationships: false },
    });
    team.members.find((member) => member.id === 'reception').roleId = 'messaging-only';
    localStorage.setItem(key, JSON.stringify(team));
    window.dispatchEvent(new StorageEvent('storage', { key }));
  }, TEAM_STORAGE);
  await expect(page.getByRole('region', { name: 'Saved recipients' })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Browse saved recipients', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel(/^Email recipients/)).toHaveValue('client@example.test');
  await next(page);
  await page.getByLabel(/^Subject/).fill('Email for the client');
  await page.getByLabel(/^Message/).fill('Please confirm receipt when delivery is connected.');
  await next(page);
  await expect(page.locator('.message-preview')).toContainText('reception@example.test');
  // A role/access update while the preview is open must be rechecked at completion.
  await page.evaluate((key) => {
    const team = JSON.parse(localStorage.getItem(key));
    team.members.find((member) => member.id === 'reception').channelAccess.email = false;
    localStorage.setItem(key, JSON.stringify(team));
    window.dispatchEvent(new StorageEvent('storage', { key }));
  }, TEAM_STORAGE);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Close preview', exact: true })
    .click();
  await expect(
    page.getByText('Your Super Admin has not allowed this messaging channel.', { exact: true }),
  ).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start a message', exact: true })).toBeDisabled();
});

test('mobile messaging and recipient review fit both themes with accessible controls', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('messages-mobile-dark.png'),
    animations: 'disabled',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Start a message', exact: true }).click();
  await noOverflow(page);
  await page.getByLabel(/^WhatsApp recipients/).fill('+971501112222\n+971551113333');
  const picker = page.getByRole('region', { name: 'Saved recipients' });
  await picker.getByRole('button', { name: 'Landlords', exact: true }).click();
  await page.getByLabel('Search recipients', { exact: true }).fill('maya');
  await picker
    .getByRole('button', { name: 'Add Maya Properties: +97140000191', exact: true })
    .click();
  await expect(
    page.getByRole('list', { name: 'Selected recipients' }).getByRole('listitem'),
  ).toHaveCount(3);
  await noOverflow(page);
  await picker.scrollIntoViewIfNeeded();
  expect(await picker.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true,
  );
  await page.screenshot({
    path: testInfo.outputPath('recipient-picker-mobile-dark.png'),
    animations: 'disabled',
  });
  await next(page);
  await page
    .getByLabel(/^Message/)
    .fill('Our next viewing is tomorrow. Please contact us to confirm.');
  await next(page);
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Close preview', exact: true }),
  ).toBeInViewport();
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('bulk-whatsapp-mobile-dark.png'),
    animations: 'disabled',
  });
  await close(page);
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  await page.getByRole('button', { name: 'Start email message', exact: true }).click();
  await page.getByLabel(/^Email recipients/).fill('first@example.test;second@example.test');
  await picker.getByRole('button', { name: 'Landlords', exact: true }).click();
  await picker
    .getByRole('button', { name: 'Add Maya Properties: maya@example.com', exact: true })
    .click();
  await noOverflow(page);
  await picker.scrollIntoViewIfNeeded();
  expect(await picker.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true,
  );
  await page.screenshot({
    path: testInfo.outputPath('recipient-picker-mobile-light.png'),
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Close recipient picker', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Browse saved recipients', exact: true }),
  ).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath('recipients-mobile-light.png'),
    animations: 'disabled',
  });
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
});
