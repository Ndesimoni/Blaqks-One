import { test, expect } from './fixtures.js';
import { signIn, session } from './helpers.js';
import { closeInvitation, finishInvitation, openTeam, startInvitation } from './team-helpers.js';
import { clickMemberAction, teamCard } from './team-status-helpers.js';

test('archived property photos and details remain viewable without editing or uploading', async ({
  page,
}) => {
  await signIn(page, 'owner');
  await openTeam(page);
  const form = await startInvitation(page, 'archive-property-owner', true);
  await finishInvitation(page, form);
  await closeInvitation(page);
  const identity = await session(page);
  const members = await (
    await page.request.get('/api/crm/workspaces/super-admin-workspace/team')
  ).json();
  const member = members.members.find(
    (person) => person.email === 'archive-property-owner@browser-team.test',
  );
  const response = await page.request.post(`/api/crm/workspaces/${member.id}/records/Properties`, {
    headers: { Origin: 'http://localhost:5175', 'X-CSRF-Token': identity.csrfToken },
    data: {
      record: {
        property_id: 'BROWSER-ARCHIVE-HOUSE',
        listing_title: 'Retained archive house',
        purpose: 'Sale',
      },
    },
  });
  expect(response.status()).toBe(201);
  await page.getByLabel('Search team').fill('Browser archive-property-owner');
  await clickMemberAction(page, member.name, `Delete account for ${member.name}`);
  const dialog = page.getByRole('dialog', { name: 'Delete account', exact: true });
  await expect(dialog).toContainText('1 retained');
  await dialog.getByLabel(`Type ${member.email} to confirm`).fill(member.email);
  await dialog.getByRole('button', { name: 'Delete and archive' }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto(`/#/properties?workspace=${member.id}`);
  await expect(page.getByText('ARCHIVED WORKSPACE · READ-ONLY', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add property', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Card view', exact: true }).click();
  await page.getByRole('button', { name: /Retained archive house/ }).click();
  const details = page.getByRole('dialog');
  await expect(
    details.getByRole('heading', { name: 'Retained archive house', exact: true }),
  ).toBeVisible();
  await expect(details.getByRole('img', { name: /sample image/ })).toBeVisible();
  await expect(
    details.getByRole('button', { name: /Edit|Delete|Upload|Add property photos/ }),
  ).toHaveCount(0);
  await details.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Table view', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Open record BROWSER-ARCHIVE-HOUSE' }),
  ).toBeVisible();
});
