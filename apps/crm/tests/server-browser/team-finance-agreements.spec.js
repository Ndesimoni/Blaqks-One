import { test, expect } from './fixtures.js';
import { day, memberPage, openFinanceSettings, saveSettings } from './team-finance-fixtures.js';
import { storedAgreements, teamFinance } from './team-finance-fixtures.js';
import { createDeal, earnDeal, heldClient } from '../api/finance-deals-helpers.mjs';

const OVERLAP = 'This agreement overlaps another agreement for this agent.';

/** Fills and submits the Add an agreement form. */
async function addAgreement(page, name, share, startsOn) {
  const editor = page.getByRole('region', { name: 'Add an agreement' });
  await editor.getByLabel('Team member').selectOption({ label: name });
  await editor.getByLabel('Agent share (%)').fill(share);
  await editor.getByLabel('Starts on').fill(startsOn);
  await editor.getByRole('button', { name: 'Add agreement', exact: true }).click();
  return editor;
}

test('an Admin adds agreements that auto-close the open one and removes a future one', async ({
  browser,
}) => {
  test.setTimeout(90000);
  const team = await teamFinance('tfagree');
  await saveSettings(team, { agentShareBp: 5000 });
  const admin = await memberPage(browser, team.people.admin.email);
  const { page } = admin;
  const name = team.people.agent.name;
  const [past, future] = [day(-30), day(30)];
  try {
    await openFinanceSettings(page);
    const list = page.getByRole('region', { name: 'Agent agreements' });
    await expect(
      list.getByText('No agreements yet. Every agent gets the team default.'),
    ).toBeVisible();
    const editor = page.getByRole('region', { name: 'Add an agreement' });
    await editor.getByRole('button', { name: 'Add agreement', exact: true }).click();
    await expect(editor.getByText('Choose a team member.')).toBeVisible();
    await expect(editor.getByLabel('Team member')).toBeFocused();
    await editor.getByLabel('Team member').selectOption({ label: name });
    await expect(editor.getByRole('note')).toContainText('This will be their first agreement.');

    await addAgreement(page, name, '60', past);
    const status = page.locator('.team-finance > .team-finance-status');
    await expect(status).toHaveText(`Agreement added for ${name}: 60% from ${past}.`);
    const timeline = list.getByRole('list', { name: `${name} agreements` });
    await expect(timeline.getByRole('listitem')).toHaveCount(1);
    await expect(timeline.getByRole('listitem').first()).toContainText('In force');

    await editor.getByLabel('Team member').selectOption({ label: name });
    await editor.getByLabel('Starts on').fill(future);
    await expect(editor.getByRole('note')).toHaveText(
      `Their open agreement (60% from ${past}) will close automatically on ${future}.`,
    );
    await addAgreement(page, name, '65.5', future);
    await expect(status).toHaveText(
      `Agreement added for ${name}: 65.5% from ${future}. Their previous agreement now closes on ${future}.`,
    );
    const items = timeline.getByRole('listitem');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText(`Future65.5%From ${future}, no end date`);
    await expect(items.nth(1)).toContainText(`In force60%From ${past}, replaced on ${future}`);
    await expect(items.nth(1).getByRole('button')).toHaveCount(0);

    // Overlaps are refused by the server and the draft stays for correction.
    await addAgreement(page, name, '70', past);
    await expect(editor.getByRole('alert')).toHaveText(OVERLAP);
    await expect(editor.getByLabel('Agent share (%)')).toHaveValue('70');

    page.once('dialog', (confirmation) => {
      expect(confirmation.message()).toContain('The agreement it replaced continues');
      confirmation.accept();
    });
    await items
      .nth(0)
      .getByRole('button', {
        name: `Remove the 65.5% agreement for ${name} starting ${future}`,
      })
      .click();
    await expect(status).toHaveText(
      'Agreement removed. The agreement it replaced has no end date again.',
    );
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText(`From ${past}, no end date`);
    const stored = await storedAgreements(team);
    expect(stored.map((row) => [row.agentShareBp, row.effectiveFrom, row.effectiveTo])).toEqual([
      [6000, past, null],
    ]);
  } finally {
    await admin.context.close();
  }
});

test('an agreement reaching back over an earned deal shows the server refusal', async ({
  browser,
}) => {
  const team = await teamFinance('tfearned');
  await saveSettings(team, { agentShareBp: 5000 });
  const deal = await createDeal(team.agent, await heldClient(team.agent), {}, team.admin);
  await earnDeal(team.admin, deal);
  const admin = await memberPage(browser, team.people.admin.email);
  try {
    await openFinanceSettings(admin.page);
    const editor = await addAgreement(admin.page, team.people.agent.name, '70', day(-1));
    await expect(editor.getByRole('alert')).toHaveText(
      'This agreement would apply to deals already earned.',
    );
    await expect(editor.getByLabel('Starts on')).toHaveValue(day(-1));
    expect(await storedAgreements(team)).toEqual([]);
  } finally {
    await admin.context.close();
  }
});
