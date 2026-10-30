import { test, expect } from './fixtures.js';
import { signInMember } from './assign-helpers.js';
import { openProperty } from './property-links-helpers.js';
import { settingsTeam } from './website-settings-helpers.js';
import { ok, property, put, websitePath } from '../api/website-helpers.mjs';

// Selected property publication (docs/website-backend.md): the Admin publishes from the
// property's details, finds it Live on Website → Properties, then withdraws it. Every record
// and profile is synthetic and lives in the disposable test database.
const title = 'Synthetic Website Marina Loft';
const secrets = ['PRIVATE-UNIT', 'PRIVATE-TOWER', 'PRIVATE-NOTES', 'PRIVATE-EXACT-ADDRESS'];

async function eligibleAdmin() {
  const team = await settingsTeam('listings');
  ok(
    await put(team.admin, websitePath(team.admin, `/profiles/${team.admin.user.id}`), {
      version: 0,
      name: 'Synthetic Public Admin',
      specialty: 'Residential properties',
      consent: true,
      active: true,
    }),
  );
  await property(team.admin, { listing_title: title });
  return team;
}

test('an Admin publishes a property from its details, sees it Live, then withdraws it', async ({
  page,
}) => {
  test.setTimeout(120000);
  const team = await eligibleAdmin();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await signInMember(page, team.admin.user.email);

  await openProperty(page, title);
  const details = page.getByRole('dialog', { name: title, exact: true });
  const panel = details.getByRole('region', { name: 'Website', exact: true });
  await expect(panel).toContainText('Not on the website');
  await panel.getByRole('button', { name: 'Publish on website', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Publish on the website', exact: true });
  await expect(dialog).toContainText('Step 1 of 4 · Agent and where');
  await expect(dialog.getByLabel('Agent shown on the listing')).toContainText(
    'Synthetic Public Admin (you)',
  );
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(dialog).toContainText('1 of 20 selected');
  await expect(dialog.getByRole('button', { name: 'Photo 1, selected, cover' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  const permit = dialog.getByLabel(/Advertising permit number/);
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(permit).toBeFocused();
  await expect(permit).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog).toContainText('Enter the advertising permit number.');
  await permit.fill('SYNTHETIC-PERMIT-77');
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();

  const visitors = dialog.getByRole('region', { name: 'What visitors will see' });
  await expect(visitors).toContainText(title);
  await expect(visitors).toContainText('SYNTHETIC-PERMIT-77');
  await expect(dialog.getByRole('region', { name: 'Stays private' })).toContainText(
    'Unit reference and building',
  );
  for (const secret of secrets) await expect(dialog).not.toContainText(secret);
  await dialog.getByRole('button', { name: 'Publish now', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.toast')).toContainText('Published on the website');
  await expect(panel).toContainText('Live since');

  const listed = ok(await team.admin.request(websitePath(team.admin, '/listings')));
  expect(listed.publications).toHaveLength(1);
  expect(listed.publications[0].active).toBe(true);
  expect(JSON.stringify(listed.publications[0].snapshot)).not.toContain('PRIVATE');

  await details.getByRole('button', { name: 'Close record details', exact: true }).click();
  await expect(details).toHaveCount(0);
  await page.goto('/#/website');
  await page.getByRole('tab', { name: 'Properties', exact: true }).click();
  const table = page.getByRole('table', { name: 'Website listings', exact: true });
  const row = table.getByRole('row', { name: new RegExp(title) });
  await expect(row).toContainText('Live');
  await expect(row).toContainText('AED 2,500,000');
  await expect(row).toContainText('Synthetic Public Admin');

  await row.getByRole('button', { name: `Withdraw ${title}`, exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Withdraw this listing?', exact: true });
  await expect(confirm).toContainText(`Take ${title} off the website?`);
  await confirm.getByRole('button', { name: 'Withdraw listing', exact: true }).click();
  await expect(confirm).toHaveCount(0);
  await expect(page.locator('.toast')).toContainText('Listing withdrawn');
  await expect(page.getByText('No matching listings')).toBeVisible();
  const filters = page.getByRole('group', { name: 'Show listings', exact: true });
  await filters.getByRole('button', { name: 'Withdrawn', exact: true }).click();
  await expect(table.getByRole('row', { name: new RegExp(title) })).toContainText('Withdrawn');

  const after = ok(await team.admin.request(websitePath(team.admin, '/listings')));
  expect(after.publications[0].active).toBe(false);
  expect(errors).toEqual([]);
});
