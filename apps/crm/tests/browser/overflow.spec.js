import { readFileSync } from 'node:fs';
import { expect, test } from './helpers/session.js';
import { chooseFormSection, saveRecordForm } from './helpers/record-form.js';
import { SEED_CRM } from '../../src/data/demo.js';
import { AMENITIES } from '../../src/config/properties.js';
import { DEMO_PASSWORD } from '../../src/config/demoAccounts.js';
import { TEAM_STORAGE } from '../../src/config/team.js';
import { today } from '../../src/lib/dates.js';
import {
  initialTeam,
  setupOwner,
  inviteMember,
  activateMember,
  saveRole,
} from '../../src/features/team/model.js';

async function seedData(page, data) {
  await page.addInitScript((data) => {
    if (!sessionStorage.getItem('kws-overflow-test-seeded')) {
      localStorage.setItem('kws-crm-v1:workspace:aidah', JSON.stringify({ data, demo: true }));
      sessionStorage.setItem('kws-overflow-test-seeded', 'true');
    }
  }, data);
}
async function panelScrolls(panel) {
  const scroll = panel.locator('.overflow-list-scroll').first();
  expect(await scroll.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
}
async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) {
    expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await expect(dialog.locator('.drawer-footer').getByRole('button').last()).toBeInViewport();
  }
}

test('results scroll continuously and property cards paginate without duplicate lists', async ({
  page,
}) => {
  const data = SEED_CRM();
  const day = today();
  data['Follow-ups'] = Array.from({ length: 20 }, (_, index) => ({
    activity_id: `FU-OVERFLOW-${String(index).padStart(2, '0')}`,
    client_id: data.Clients[0].client_id,
    next_action: `Overflow meeting ${index}`,
    due_date: day,
    task_status: 'Open',
    calendar_enabled: 'Yes',
    calendar_activity: 'Meeting',
    calendar_start: `${day}T10:00`,
    calendar_duration: '30',
    calendar_invite: 'No',
  }));
  data.Properties.push(
    ...Array.from({ length: 10 }, (_, index) => ({
      ...data.Properties[0],
      property_id: `PR-OVERFLOW-${index}`,
      listing_title: `Extra listing ${index}`,
      sale_rental: 'Sale',
      community: 'Dubai Marina',
      price_annual_rent_aed: '1000000',
    })),
  );
  await seedData(page, data);
  await page.goto('/#/date-search');
  await page.getByLabel('RECORD TYPE', { exact: true }).selectOption('Follow-ups');
  await page.getByLabel('FROM DATE', { exact: true }).fill(day);
  await page.getByLabel('TO DATE', { exact: true }).fill(day);
  await expect(
    page.getByRole('list', { name: 'Date search matches', exact: true }).getByRole('listitem'),
  ).toHaveCount(20);
  const dates = page.locator('.record-results-list');
  await expect(page.getByRole('button', { name: /^More date search matches/ })).toHaveCount(0);
  await expect(dates.getByRole('listitem')).toHaveCount(20);
  await expect(dates).toContainText('FU-OVERFLOW-00');
  await panelScrolls(dates);
  await dates.getByRole('button', { name: /FU-OVERFLOW-19/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Overflow meeting 19');
  await page.getByRole('button', { name: 'Close record details', exact: true }).click();
  await page.goto('/#/client-desk');
  await page
    .getByRole('list', { name: 'Client desk contacts', exact: true })
    .getByRole('button', { name: new RegExp(data.Clients[0].full_name) })
    .click();
  const matches = page.getByRole('list', { name: 'Matching properties', exact: true });
  await expect(page.getByRole('button', { name: /^More matching properties/ })).toHaveCount(0);
  const row = matches.getByRole('listitem').filter({ hasText: 'Extra listing 9' });
  await row.getByRole('button', { name: 'Shortlist', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('New match');
  await expect(page.locator('#property_id')).toHaveValue('PR-OVERFLOW-9');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.goto('/#/properties');
  await expect(
    page.getByRole('list', { name: 'Property listings', exact: true }).getByRole('listitem'),
  ).toHaveCount(12);
  const pages = page.getByRole('navigation', { name: 'Property pages', exact: true });
  await expect(page.getByRole('button', { name: /^More property listings/ })).toHaveCount(0);
  await expect(pages).toContainText('Showing 1–12 of 23 properties');
  await pages.getByRole('button', { name: 'Next', exact: true }).click();
  const listings = page.getByRole('list', { name: 'Property listings', exact: true });
  await expect(listings.getByRole('listitem')).toHaveCount(11);
  await expect(pages).toContainText('Showing 13–23 of 23 properties');
  await listings.getByRole('button', { name: /Extra listing 9/ }).click();
  await expect(page.getByRole('dialog')).toContainText('PR-OVERFLOW-9');
  await page.getByRole('button', { name: 'Close record details', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Search properties', exact: true })
    .fill('no-such-property');
  await expect(page.getByText('No properties match those filters', { exact: true })).toBeVisible();
  await expect(pages).toContainText('Showing 0–0 of 0 properties');
  await page.getByRole('button', { name: 'Clear all filters', exact: true }).click();
  await expect(listings.getByRole('listitem')).toHaveCount(12);
  await expect(pages).toContainText('Page 1 of 2');
});

test('messaging shows six compact recipients and every recipient in More and lets hidden chips be removed without losing the draft', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/messages');
  await page.getByRole('button', { name: 'Start email message', exact: true }).click();
  const raw = Array.from({ length: 20 }, (_, index) => `recipient-${index}@example.test`);
  const field = page.getByLabel(/^Email recipients/);
  await field.fill(raw.join('\n'));
  const selected = page.getByRole('list', { name: 'Selected recipients', exact: true });
  await expect(selected.getByRole('listitem')).toHaveCount(6);
  const matching = page.getByRole('list', { name: 'Matching recipients', exact: true });
  expect(await matching.getByRole('listitem').count()).toBeGreaterThan(6);
  await expect(page.getByRole('button', { name: /^More matching recipients/ })).toHaveCount(0);
  const more = page.getByRole('button', { name: 'More selected recipients (14)', exact: true });
  await more.click();
  await expect(selected).toHaveCount(0);
  await expect(more).toHaveCount(0);
  const extras = page.getByRole('region', { name: 'More selected recipients', exact: true });
  await panelScrolls(extras);
  await expect(extras.getByRole('listitem')).toHaveCount(20);
  await expect(extras.getByRole('listitem')).toHaveText(raw);
  await extras
    .getByRole('button', { name: 'Remove recipient-0@example.test', exact: true })
    .click();
  raw.shift();
  await expect(extras).not.toContainText('recipient-0@example.test');
  await extras
    .getByRole('button', { name: 'Remove recipient-19@example.test', exact: true })
    .click();
  raw.pop();
  await expect(field).toHaveValue(raw.join('\n'));
  await page.keyboard.press('Escape');
  await expect(extras).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'More selected recipients (12)', exact: true }),
  ).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.getByRole('button', { name: 'More selected recipients (12)', exact: true }).click();
  await page.getByLabel('Search recipients', { exact: true }).focus();
  await expect(extras).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByLabel(/^Subject/).fill('All selected people');
  await page.getByLabel(/^Message/).fill('Keep every selected address in the full preview.');
  await page.getByRole('dialog').getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('list', { name: 'Reviewed recipients', exact: true }).getByRole('listitem'),
  ).toHaveCount(raw.length);
  await expect(page.getByRole('button', { name: /^More reviewed recipients/ })).toHaveCount(0);
  const review = page.locator('.recipient-review-list');
  await panelScrolls(review);
  await expect(review.getByRole('listitem')).toHaveText(raw);
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('recipient-overflow-mobile-dark.png'),
    animations: 'disabled',
  });
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Close preview', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('property filters, photos, amenities and form sections use More and preserve hidden selections and files through save', async ({
  page,
}, testInfo) => {
  const data = SEED_CRM();
  const src = `data:image/jpeg;base64,${readFileSync(new URL('../fixtures/property-photo.jpg', import.meta.url)).toString('base64')}`;
  data.Properties[0].amenities = AMENITIES.slice(0, 8).join(', ');
  data.Properties[0].media_photos = Array.from({ length: 8 }, (_, index) => ({
    name: `Photo ${index + 1}`,
    type: 'image/jpeg',
    src,
  }));
  await seedData(page, data);
  await page.goto('/#/properties');
  await expect(
    page
      .getByRole('list', { name: 'Filter by listing purpose', exact: true })
      .getByRole('listitem'),
  ).toHaveCount(6);
  await expect(
    page.getByRole('list', { name: 'Property listings', exact: true }).getByRole('listitem'),
  ).toHaveCount(12);
  await expect(page.getByRole('button', { name: /^More filter by listing purpose/ })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: /^Commercial/ }).click();
  await expect(
    page
      .getByRole('list', { name: 'Filter by listing purpose', exact: true })
      .getByRole('button', { name: /^Commercial/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /^All listings/ }).click();
  await page.locator('.modern-property-card').first().click();
  await expect(
    page.getByRole('list', { name: 'Property amenities', exact: true }).getByRole('listitem'),
  ).toHaveCount(6);
  await page.getByRole('button', { name: 'More property amenities (2)', exact: true }).click();
  await expect(
    page.getByRole('list', { name: 'All property amenities', exact: true }),
  ).toContainText('Sea view');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(
    page
      .getByRole('list', { name: 'Property photo thumbnails', exact: true })
      .getByRole('listitem'),
  ).toHaveCount(7);
  await expect(page.getByRole('button', { name: /^More property photo thumbnails/ })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('list', { name: 'Property photo thumbnails', exact: true }).getByRole('link'),
  ).toHaveCount(7);
  await page.getByRole('button', { name: 'Edit record', exact: true }).click();
  await expect(
    page.getByRole('list', { name: 'Form section choices', exact: true }).getByRole('listitem'),
  ).toHaveCount(6);
  await chooseFormSection(page, 'Step 4: Photos & presentation');
  const photos = page.getByRole('list', { name: 'Property photos', exact: true });
  await expect(photos.getByRole('listitem')).toHaveCount(8);
  await expect(page.getByRole('button', { name: /^More property photos/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Remove photo 8', exact: true }).click();
  await expect(photos.getByRole('listitem')).toHaveCount(7);
  const amenities = page.locator('.amenity-options-list');
  await expect(amenities.getByRole('button')).toHaveCount(AMENITIES.length);
  await expect(page.getByRole('button', { name: /^More amenity options/ })).toHaveCount(0);
  await expect(amenities.getByRole('button', { name: 'Balcony', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await amenities.getByRole('button', { name: 'Balcony', exact: true }).click();
  await expect(amenities.getByRole('button', { name: 'Balcony', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await amenities.getByRole('button', { name: 'Beach access', exact: true }).click();
  await expect(
    amenities.getByRole('button', { name: 'Beach access', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#amenities')).toHaveValue(/Beach access/);
  for (const theme of ['dark', 'light']) {
    await page.setViewportSize({ width: 390, height: 844 });
    if (theme === 'light')
      await page.evaluate(() => (document.documentElement.dataset.theme = 'light'));
    await amenities.scrollIntoViewIfNeeded();
    await noOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`amenity-overflow-mobile-${theme}.png`),
      animations: 'disabled',
    });
  }
  await saveRecordForm(page);
  await page.reload();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('kws-crm-v1:workspace:aidah')).data.Properties[0],
  );
  expect(saved.media_photos).toHaveLength(7);
  expect(saved.amenities).toContain('Beach access');
  expect(saved.amenities).not.toContain('Balcony');
});

test('Client desk scrolls one searchable list and preserves the selected client', async ({
  page,
}, testInfo) => {
  const data = SEED_CRM();
  data.Clients.push(
    ...Array.from({ length: 10 }, (_, index) => ({
      ...data.Clients[0],
      client_id: `CL-EXTRA-${index}`,
      full_name: `Extra Contact ${index}`,
      email: `extra-${index}@example.test`,
    })),
  );
  await seedData(page, data);
  await page.goto('/#/client-desk');
  const contacts = page.getByRole('list', { name: 'Client desk contacts', exact: true });
  await expect(contacts.getByRole('listitem')).toHaveCount(data.Clients.length);
  await expect(page.getByRole('button', { name: /^More client desk contacts/ })).toHaveCount(0);
  const last = data.Clients.at(-1);
  await contacts.getByRole('button', { name: new RegExp(last.full_name) }).click();
  await expect(contacts.getByRole('button', { name: new RegExp(last.full_name) })).toHaveClass(
    /selected/,
  );
  await expect(page.locator('.profile-head h2')).toHaveText(last.full_name);
  await page
    .getByRole('textbox', { name: 'Search clients in client desk', exact: true })
    .fill(last.full_name);
  await expect(contacts.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^More client desk contacts/ })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Search clients in client desk', exact: true }).fill('');
  await page.setViewportSize({ width: 390, height: 844 });
  await panelScrolls(page.locator('.client-picker-list'));
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('client-chooser-overflow-mobile.png'),
    animations: 'disabled',
    fullPage: true,
  });
});

test('team member/role overflow and permission choices retain hidden access settings and modal focus', async ({
  page,
}, testInfo) => {
  const password = { password: DEMO_PASSWORD, confirmPassword: DEMO_PASSWORD };
  let team = setupOwner(
    initialTeam(),
    { name: 'Aidah', email: 'aidah@keyswithsimoni.test', phone: '+971501234567', ...password },
    'aidah',
  ).team;
  for (let index = 0; index < 8; index++) {
    team = inviteMember(
      team,
      'aidah',
      {
        name: `Team Member ${index}`,
        email: `member-${index}@example.test`,
        roleId: 'staff',
        channelAccess: { email: true, whatsapp: true },
      },
      `member-${index}`,
    ).team;
    team = activateMember(team, `member-${index}`, 1, {
      name: `Team Member ${index}`,
      phone: `+97150123456${index}`,
      ...password,
    });
  }
  for (let index = 0; index < 3; index++)
    team = saveRole(
      team,
      'aidah',
      {
        name: `Custom Role ${index}`,
        permissions: team.roles.find((role) => role.id === 'staff').permissions,
      },
      `custom-${index}`,
    );
  await page.addInitScript(({ key, team }) => localStorage.setItem(key, JSON.stringify(team)), {
    key: TEAM_STORAGE,
    team,
  });
  await page.goto('/#/team-access');
  const members = page.getByRole('table', { name: 'Team members', exact: true });
  await expect(members.locator('tbody tr')).toHaveCount(team.members.length);
  await expect(page.getByRole('button', { name: /^More team members/ })).toHaveCount(0);
  await panelScrolls(page.locator('.team-directory-list'));
  const manage = members.getByRole('button', { name: 'Manage Team Member 7', exact: true });
  await manage.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(manage).toBeFocused();
  await page.getByRole('button', { name: 'Roles & permissions', exact: true }).click();
  const roles = page.getByRole('list', { name: 'Team roles', exact: true });
  await expect(
    roles.getByRole('listitem').filter({ has: page.locator('.team-role-card') }),
  ).toHaveCount(team.roles.length);
  await expect(page.getByRole('button', { name: /^More team roles/ })).toHaveCount(0);
  await roles
    .locator('.team-role-card')
    .filter({ has: page.getByRole('heading', { name: 'Custom Role 2', exact: true }) })
    .getByRole('button', { name: 'Edit role', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  const permissionChoices = dialog.getByRole('list', {
    name: 'CRM permission options',
    exact: true,
  });
  await expect(permissionChoices.getByRole('listitem')).toHaveCount(6);
  await expect(dialog.getByRole('button', { name: /^More crm permission options/ })).toHaveCount(0);
  const permission = dialog.getByRole('checkbox', { name: /Imports & exports/ });
  await permission.check();
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(dialog.getByRole('button', { name: /^More role permissions/ })).toHaveCount(0);
  await expect(dialog.getByRole('list', { name: 'Role permissions', exact: true })).toContainText(
    'Imports & exportsAllowed',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('role-permissions-overflow-mobile.png'),
    animations: 'disabled',
  });
  await dialog.getByRole('button', { name: 'Save role', exact: true }).click();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), TEAM_STORAGE);
  expect(saved.roles.find((role) => role.id === 'custom-2').permissions.exports).toBe(true);
});
