import { test, expect } from './fixtures.js';
import { assignTeam, held } from './assign-fixtures.js';
import { memberPage, openRecord } from './assign-helpers.js';
import { setGrants } from './permissions-fixtures.js';
import { contact, openProperty, visibleIds } from './property-links-helpers.js';

const TOWER = 'Palm Tower';

test('assigned-only staff see only server-visible building contacts and properties', async ({
  browser,
}) => {
  const team = await assignTeam('plvis');
  const { one, two } = team.people;
  const place = (row, holder) => held(team, 'Contacts', row, holder);
  await place(contact('CT-V-OWN', 'Vis Owner', 'Landlord', TOWER, '+971 50 111 0000'));
  await place(
    contact('CT-V-G1', 'Vis Guard Mine', 'Security guard', TOWER, '+971 50 111 0001'),
    one.id,
  );
  await place(
    contact('CT-V-G2', 'Secret Guard Two', 'Security guard', TOWER, '+971 50 111 0002'),
    two.id,
  );
  await place(
    contact('CT-V-M1', 'Secret Manager Queue', 'Building manager', TOWER, '+971 50 111 0003'),
  );
  await place(contact('CT-V-M2', 'Vis Manager Mine', 'Building manager', TOWER, ''), one.id);
  await place(
    contact('CT-V-M3', 'Vis Manager Linked', 'Building manager', TOWER, '+971 50 111 0005'),
  );
  const property = (property_id, listing_title, contact_id, holder) =>
    held(
      team,
      'Properties',
      { property_id, listing_title, contact_id, building_project: TOWER },
      holder,
    );
  await property('PR-V1', 'Vis held tower unit', 'CT-V-OWN', one.id);
  await property('PR-V2', 'Vis second held unit', 'CT-V-M3', one.id);
  await property('PR-V3', 'Secret unit of two', 'CT-V-OWN', two.id);
  const { page, context } = await memberPage(browser, one.email);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    const contacts = await visibleIds(page, 'Contacts', 'contact_id');
    expect(contacts.body.scope).toBe('assigned');
    expect(contacts.ids).toEqual(['CT-V-G1', 'CT-V-M2', 'CT-V-M3', 'CT-V-OWN']);
    const properties = await visibleIds(page, 'Properties', 'property_id');
    expect(properties.ids).toEqual(['PR-V1', 'PR-V2']);
    expect(JSON.stringify(contacts.body)).not.toMatch(/Secret|CT-V-G2|CT-V-M1|PR-V3/);

    const { card, details } = await openProperty(page, 'Vis held tower unit');
    await expect(
      details.getByRole('button', { name: 'Vis Owner · Landlord', exact: true }),
    ).toBeVisible();
    const building = details.getByRole('region', { name: 'Building contacts', exact: true });
    const rows = building.locator('.related-record');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Vis Guard MineSecurity guard');
    await expect(rows.nth(1)).toContainText('Vis Manager LinkedBuilding manager');
    await expect(rows.nth(2)).toContainText('Vis Manager MineBuilding manager');
    await expect(rows.nth(2).getByRole('link')).toHaveCount(0);
    await expect(details).not.toContainText(/Secret|CT-V-G2|CT-V-M1/);
    await rows.nth(1).getByRole('button').click();
    await expect(details.locator('h2')).toHaveText('Vis Manager Linked');
    const linked = details.getByRole('region', { name: 'Linked properties', exact: true });
    await expect(linked.locator('.related-record')).toHaveCount(1);
    await expect(linked).toContainText('Vis second held unit');
    const nearby = details.getByRole('region', { name: 'Properties in this building' });
    await expect(nearby.locator('.related-record')).toHaveCount(1);
    await expect(nearby).toContainText('Vis held tower unit');
    await expect(details).not.toContainText(/Secret unit|PR-V3/);
    await page.keyboard.press('Escape');
    await expect(card).toBeFocused();

    await page.goto('/#/contacts');
    const owner = await openRecord(page, 'CT-V-OWN');
    const ownerLinked = owner.getByRole('region', { name: 'Linked properties', exact: true });
    await expect(ownerLinked.locator('.related-record')).toHaveCount(1);
    await expect(ownerLinked).toContainText('Vis held tower unit');
    await expect(owner).not.toContainText(/Secret unit|PR-V3/);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('staff without Contacts or Properties access see no related records from that module', async ({
  browser,
}) => {
  const team = await assignTeam('plmod');
  const { one, two } = team.people;
  const without = (module) => (member) => ({
    permissions: { ...member.permissions, [module]: false },
  });
  await setGrants(team, 'one', without('relationships'));
  await setGrants(team, 'two', without('properties'));
  await held(
    team,
    'Contacts',
    contact('CT-M-OWN', 'Mod Owner', 'Landlord', 'Creek Tower', ''),
    two.id,
  );
  await held(team, 'Contacts', contact('CT-M-G', 'Mod Guard', 'Security guard', 'Creek Tower', ''));
  const listing = { contact_id: 'CT-M-OWN', building_project: 'Creek Tower' };
  await held(
    team,
    'Properties',
    { property_id: 'PR-M1', listing_title: 'Mod unit', ...listing },
    one.id,
  );
  await held(team, 'Properties', { property_id: 'PR-M2', listing_title: 'Mod other', ...listing });

  const noContacts = await memberPage(browser, one.email);
  try {
    const { page } = noContacts;
    const { body, ids } = await visibleIds(page, 'Contacts', 'contact_id');
    expect(ids).toEqual([]);
    expect(JSON.stringify(body)).not.toMatch(/Mod Owner|Mod Guard/);
    const { details } = await openProperty(page, 'Mod unit');
    await expect(details).toContainText('CT-M-OWN · Linked record unavailable');
    await expect(details.locator('.detail-record-link')).toHaveCount(0);
    await expect(details.getByRole('region', { name: 'Building contacts' })).toHaveCount(0);
    await expect(details).not.toContainText(/Mod Owner|Mod Guard/);
  } finally {
    await noContacts.context.close();
  }
  const noProperties = await memberPage(browser, two.email);
  try {
    const { page } = noProperties;
    const { body, ids } = await visibleIds(page, 'Properties', 'property_id');
    expect(ids).toEqual([]);
    expect(JSON.stringify(body)).not.toMatch(/Mod unit|Mod other/);
    await page.goto('/#/contacts');
    const owner = await openRecord(page, 'CT-M-OWN');
    await expect(owner.locator('h2')).toHaveText('Mod Owner');
    await expect(owner.locator('.related-records')).toHaveCount(0);
    await expect(
      owner.getByRole('region', { name: /Linked properties|in this building/ }),
    ).toHaveCount(0);
    await expect(owner).not.toContainText(/Mod unit|Mod other|PR-M/);
  } finally {
    await noProperties.context.close();
  }
});
