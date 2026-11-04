import { jpegPhoto } from '../api/media-helpers.mjs';
import { shots } from './agreements-helpers.js';
import { assignTeam } from './assign-fixtures.js';
import { openSection } from './assign-helpers.js';
import { openMember, prepare } from './marketplace-apply-helpers.js';
import { expect, test } from './fixtures.js';
import { signIn } from './helpers.js';

// Broker marketplace MK1a (docs/broker-marketplace.md §13–§15): an Admin applies once the
// company uses the CRM, the Super Admin approves, and the company switch appears.
const company = 'Synthetic market-apply-admin';

test('an Admin applies, the Super Admin approves, and the switch appears', async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(240000);
  const team = await assignTeam('market-apply');
  await prepare(team);
  const admin = await openMember(browser, team.people.admin.email);
  try {
    await openSection(admin.page, 'Marketplace');
    await expect(
      admin.page.getByRole('heading', { level: 1, name: 'Board', exact: true }),
    ).toBeVisible();
    await expect(admin.page.getByText('What Blaqks One looks for')).toBeVisible();
    await expect(admin.page.getByText('5 of 5').first()).toBeVisible();
    await shots(admin.page, testInfo, 'marketplace-checklist');
    await admin.page.getByRole('button', { name: 'Apply to the marketplace' }).click();
    await expect(
      admin.page.getByRole('heading', { name: 'Waiting for Blaqks One approval' }),
    ).toBeVisible();
    await shots(admin.page, testInfo, 'marketplace-pending');

    await signIn(page, 'owner');
    await openSection(page, 'Marketplace applications');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Marketplace applications' }),
    ).toBeVisible();
    const card = page.locator('.market-application', { hasText: company });
    await expect(card).toContainText('5 properties');
    await card.getByRole('button', { name: 'Approve', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(company);
    await shots(page, testInfo, 'marketplace-decision');
    await dialog.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(page.locator('.market-application', { hasText: company })).toContainText(
      'Approved',
    );

    await admin.page.reload();
    await expect(
      admin.page.getByRole('heading', { level: 1, name: 'Board', exact: true }),
    ).toBeVisible({
      timeout: 30000,
    });
    await expect(admin.page.getByText('Your company is approved')).toBeVisible({ timeout: 30000 });
    await expect(
      admin.page.getByRole('button', { name: 'Turn the marketplace off', exact: true }),
    ).toBeVisible({ timeout: 30000 });
    await admin.page.getByRole('button', { name: 'Turn the marketplace off', exact: true }).click();
    await expect(
      admin.page.getByRole('button', { name: 'Turn the marketplace on', exact: true }),
    ).toBeVisible();
    await shots(admin.page, testInfo, 'marketplace-approved');
    // Switched off, the company's members cannot join; the Admin turns it back on first.
    await admin.page.getByRole('button', { name: 'Turn the marketplace on', exact: true }).click();
    await expect(
      admin.page.getByRole('button', { name: 'Turn the marketplace off', exact: true }),
    ).toBeVisible();

    // MK1b: join with a profile and a photo, preview how others see it, then leave.
    await admin.page.getByRole('button', { name: 'Join the marketplace', exact: true }).click();
    await expect(admin.page.getByText('Step 1 of 4')).toBeVisible();
    await admin.page.getByRole('checkbox', { name: 'Dubai', exact: true }).check();
    await admin.page.getByRole('checkbox', { name: 'Residential sale', exact: true }).check();
    await admin.page.locator('textarea').fill('Dubai Marina');
    await admin.page.getByLabel(/Years of experience/).fill('5');
    await admin.page.getByLabel(/Licence number/).fill('12345');
    await shots(admin.page, testInfo, 'marketplace-join');
    await admin.page.getByRole('button', { name: 'Next', exact: true }).click();
    for (const line of [
      /I only post requests/,
      /I agree the commission split/,
      /I pay agreed commissions/,
      /I understand Blaqks One can suspend/,
    ])
      await admin.page.getByRole('checkbox', { name: line }).check();
    await admin.page.getByRole('checkbox', { name: /My name, photo, company/ }).check();
    await admin.page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(
      admin.page.getByText('Draft for UAE lawyer review. Launch needs the reviewed text.', {
        exact: true,
      }),
    ).toBeVisible();
    await shots(admin.page, testInfo, 'marketplace-terms');
    await admin.page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(admin.page.getByText('Review what you will publish')).toBeVisible();
    await admin.page.getByRole('button', { name: 'Join the marketplace', exact: true }).click();
    await expect(admin.page.getByText(/^What clients are looking for/)).toBeVisible({
      timeout: 30000,
    });
    await openSection(admin.page, 'Broker profile');
    await expect(admin.page.getByRole('heading', { name: 'My marketplace profile' })).toBeVisible();
    await shots(admin.page, testInfo, 'marketplace-mine');
    await admin.page.locator('input[type=file]').setInputFiles({
      name: 'broker.jpg',
      mimeType: 'image/jpeg',
      buffer: jpegPhoto(),
    });
    await expect(
      admin.page.getByRole('button', { name: 'Change photo', exact: true }),
    ).toBeVisible();
    await admin.page
      .getByRole('button', { name: 'Preview how others see me', exact: true })
      .click();
    const preview = admin.page.getByRole('dialog', { name: 'Marketplace profile' });
    await expect(preview).toContainText('Synthetic market-apply-admin');
    await expect(preview).toContainText('Dubai Marina');
    await expect(preview).toContainText('Declared by the broker');
    await expect(preview).not.toContainText('@');
    await shots(admin.page, testInfo, 'marketplace-profile');
    await preview.getByRole('button', { name: 'Close', exact: true }).click();
    await admin.page.getByRole('button', { name: 'Leave the marketplace', exact: true }).click();
    const leave = admin.page.getByRole('dialog');
    await expect(leave).toContainText('Leave the marketplace?');
    await leave.getByRole('button', { name: 'Leave the marketplace', exact: true }).click();
    await expect(
      admin.page.getByRole('button', { name: 'Join the marketplace', exact: true }),
    ).toBeVisible();
  } finally {
    await admin.context.close();
  }
});
