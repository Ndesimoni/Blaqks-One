import { test, expect } from './fixtures.js';
import { assignTeam, held } from './assign-fixtures.js';
import { memberPage, noPageOverflow, openRecord } from './assign-helpers.js';

// Record sharing R1 (docs/record-sharing.md): one client, holder to one colleague, view only.
const record = {
  full_name: 'Synthetic Sharewell',
  phone: '+971500000101',
  email: 'sharewell.client@example.test',
  notes: 'Holder-only synthetic note',
};

async function shareWith(page, id, colleague) {
  const details = await openRecord(page, id);
  const sharing = details.getByRole('region', { name: 'Sharing', exact: true });
  await expect(sharing).toContainText('Not shared yet');
  await sharing.getByRole('button', { name: `Share ${id} with a colleague` }).click();
  const dialog = page.getByRole('dialog', { name: 'Share with a colleague', exact: true });
  await dialog
    .getByRole('combobox', { name: /^Colleague/ })
    .selectOption({ label: colleague.name });
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  const sent = page.getByRole('dialog', { name: `Shared with ${colleague.name}`, exact: true });
  await expect(sent).toBeVisible();
  const link = await sent.getByLabel('Share link').inputValue();
  expect(link).toMatch(/^http:\/\/localhost:5175\/#\/shares\/[0-9a-f-]{36}$/);
  const whatsApp = sent.getByRole('link', { name: 'Share on WhatsApp' });
  const href = await whatsApp.getAttribute('href');
  expect(href.startsWith('https://wa.me/?text=')).toBe(true);
  const text = decodeURIComponent(href.slice('https://wa.me/?text='.length));
  expect(text).toContain('shared a lead with you in Blaqks One');
  expect(text).toContain(link);
  for (const secret of [record.full_name, 'Sharewell', record.phone, id])
    expect(text).not.toContain(secret);
  await sent.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(sent.getByRole('status')).toHaveText('Link copied.');
  await sent.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(sent).toHaveCount(0);
  await expect(sharing).toContainText('Shared with 1 colleague');
  await expect(sharing).toContainText(`Shared with ${colleague.name}`);
  await expect(sharing).toContainText('Waiting for an answer');
  return { link, details };
}

test('a holder shares a client, the colleague accepts a view-only copy, and stopping removes it', async ({
  browser,
}) => {
  const team = await assignTeam('share-r1');
  const { one, two } = team.people;
  const client = await held(team, 'Clients', record, one.id);
  const id = client.record.client_id;
  const holder = await memberPage(browser, one.email);
  const colleague = await memberPage(browser, two.email);
  const stranger = await memberPage(browser, `share-r1-other@team-fixture.test`);
  await holder.context.grantPermissions(['clipboard-read', 'clipboard-write']);
  try {
    await holder.page.goto('/#/clients');
    const { link } = await shareWith(holder.page, id, two);
    const path = link.slice('http://localhost:5175'.length);

    // Another company's Admin gets the same plain refusal as any stranger.
    await stranger.page.goto(path);
    const refused = stranger.page.getByRole('dialog', { name: 'Shared record' });
    await expect(refused.getByRole('alert')).toHaveText("This share isn't available to you.");

    const { page } = colleague;
    // Signed in before the share was sent: a fresh load shows it at once (else within 15 s).
    await page.goto('/#/clients');
    await page.reload();
    await expect(page.getByRole('table', { name: 'Clients records' })).toBeVisible();
    const sidebar = page.getByRole('navigation', { name: 'CRM sections', exact: true });
    await expect(
      sidebar.getByRole('button', { name: 'Clients, 1 lead shared with you', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: `Open record ${id}` })).toHaveCount(0);

    // The link shows only the offer: type, label, sender, dates and status.
    await page.goto(path);
    const offer = page.getByRole('dialog', { name: 'Synthetic S.', exact: true });
    await expect(offer).toContainText('Lead');
    await expect(offer).toContainText(one.name);
    await expect(offer).toContainText('Waiting for an answer');
    await expect(offer).not.toContainText(record.phone);
    await offer.getByRole('button', { name: 'Close Synthetic S.' }).click();
    await expect(page).toHaveURL(/#\/clients$/);

    const panel = page.getByRole('region', { name: 'Shared with you', exact: true });
    await expect(panel).toContainText(`Lead from ${one.name}`);
    await panel.getByRole('button', { name: `Accept Synthetic S. from ${one.name}` }).click();
    await expect(panel.getByRole('status')).toContainText('now shows in your list as view only');
    const row = page.getByRole('row', { name: new RegExp(id) });
    await expect(row).toContainText('View only');
    await expect(row.getByRole('button', { name: /Start message/ })).toHaveCount(0);
    await expect(
      sidebar.getByRole('button', { name: 'Clients', exact: true }),
      'the badge clears after answering',
    ).toBeVisible();
    await noPageOverflow(page);

    const copy = await openRecord(page, id);
    await expect(copy.getByRole('note')).toContainText(`View only. Shared with you by ${one.name}`);
    await expect(copy).toContainText(record.phone);
    await expect(copy).toContainText(record.email);
    await expect(copy).not.toContainText(record.notes);
    await expect(copy.locator('a[href^="tel:"], a[href^="mailto:"], a[href*="wa.me"]')).toHaveCount(
      0,
    );
    for (const action of ['Edit record', 'Delete', 'Start message', 'Reassign'])
      await expect(copy.getByRole('button', { name: action, exact: true })).toHaveCount(0);
    await expect(copy.getByRole('region', { name: 'Sharing' })).toHaveCount(0);
    await copy.getByRole('button', { name: 'Close', exact: true }).click();

    await holder.page.reload();
    const details = await openRecord(holder.page, id);
    const sharing = details.getByRole('region', { name: 'Sharing', exact: true });
    await expect(sharing).toContainText('Accepted');
    await sharing.getByRole('button', { name: `Stop sharing with ${two.name}` }).click();
    await expect(sharing.getByRole('status')).toContainText(`Stopped sharing with ${two.name}`);
    await expect(sharing).toContainText('Stopped');
    await expect(sharing).toContainText('Not shared yet');

    await page.reload();
    await expect(page.getByRole('table', { name: 'Clients records' })).toBeVisible();
    await expect(page.getByRole('button', { name: `Open record ${id}` })).toHaveCount(0);
  } finally {
    await holder.context.close();
    await colleague.context.close();
    await stranger.context.close();
  }
});
