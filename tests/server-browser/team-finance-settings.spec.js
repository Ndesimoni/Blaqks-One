import { test, expect } from './fixtures.js';
import { signIn } from './helpers.js';
import { memberPage, openFinanceSettings, saveSettings } from './team-finance-fixtures.js';
import { storedSettings, teamFinance } from './team-finance-fixtures.js';

const PERCENT = 'Percentages must be between 0 and 100 with up to two decimals.';

test('an Admin sets up finance settings, then keeps the draft through a version conflict', async ({
  browser,
}) => {
  test.setTimeout(90000);
  const team = await teamFinance('tfset');
  const admin = await memberPage(browser, team.people.admin.email);
  const { page } = admin;
  try {
    const panel = await openFinanceSettings(page);
    await expect(panel.getByRole('note')).toHaveText(
      "Set up your team's commission split before marking deals earned.",
    );
    const share = panel.getByLabel('Agent share (%)');
    const referral = panel.getByLabel('Largest referral share (%)');
    await share.fill('12.345');
    await panel.getByRole('button', { name: 'Save settings', exact: true }).click();
    await expect(panel.getByText(PERCENT)).toBeVisible();
    await expect(share).toBeFocused();
    await expect(share).toHaveAttribute('aria-invalid', 'true');
    expect(await storedSettings(team)).toBeNull();

    await share.fill('60.5');
    await expect(panel.getByText('The company keeps 39.5%.')).toBeVisible();
    await referral.fill('15');
    await panel.getByRole('radio', { name: "The company's share" }).check();
    await panel.getByRole('checkbox', { name: 'VAT registered' }).check();
    await expect(panel.getByText('VAT rate 5% (fixed)')).toBeVisible();
    await panel.getByLabel('TRN').fill('12345');
    await panel.getByRole('button', { name: 'Save settings', exact: true }).click();
    await expect(panel.getByText('Enter a 15-digit TRN.')).toBeVisible();
    await panel.getByLabel('TRN').fill('100123456700003');
    await panel.getByRole('button', { name: 'Save settings', exact: true }).click();
    await expect(panel.getByRole('status')).toHaveText('Finance settings saved.');
    await expect(panel.getByRole('note')).toHaveCount(0);
    expect(await storedSettings(team)).toEqual({
      version: 1,
      agentShareBp: 6050,
      secondAgentSource: 'company',
      maxReferralShareBp: 1500,
      vatRegistered: true,
      vatRateBp: 500,
      trn: '100123456700003',
    });

    // Someone else saves first: the stale save is refused and the draft stays.
    await saveSettings(team, { agentShareBp: 5500, secondAgentSource: 'company' });
    await share.fill('70');
    await panel.getByRole('button', { name: 'Save settings', exact: true }).click();
    await expect(panel.getByRole('alert')).toHaveText(
      'Finance settings changed. Reload before saving. Your changes are still here.',
    );
    await expect(share).toHaveValue('70');
    expect((await storedSettings(team)).agentShareBp).toBe(5500);
    await panel.getByRole('button', { name: 'Load latest settings', exact: true }).click();
    await expect(share).toHaveValue('55');
    await expect(panel.getByRole('alert')).toHaveCount(0);
    await share.fill('57.25');
    await panel.getByRole('button', { name: 'Save settings', exact: true }).click();
    await expect(panel.getByRole('status')).toHaveText('Finance settings saved.');
    expect((await storedSettings(team)).agentShareBp).toBe(5725);

    // The draft survives switching to People and back.
    await share.fill('58');
    const tabs = page.getByRole('group', { name: 'Team & access views' });
    await tabs.getByRole('button', { name: 'People', exact: true }).click();
    await expect(page.getByLabel('Search team')).toBeVisible();
    await tabs.getByRole('button', { name: 'Finance settings', exact: true }).click();
    await expect(share).toHaveValue('58');
  } finally {
    await admin.context.close();
  }
});

test('staff and the Super Admin never see finance settings', async ({ browser }) => {
  const team = await teamFinance('tfstaff');
  for (const email of [team.people.agent.email, team.people.desk.email]) {
    const staff = await memberPage(browser, email);
    try {
      await staff.page.goto('/#/team-access');
      await expect(staff.page.getByRole('heading', { name: 'Access is restricted' })).toBeVisible();
      await expect(staff.page.getByRole('button', { name: 'Finance settings' })).toHaveCount(0);
    } finally {
      await staff.context.close();
    }
  }
  const owner = await browser.newContext();
  const page = await owner.newPage();
  try {
    await signIn(page, 'owner');
    await page.goto('/#/team-access');
    await expect(page.getByLabel('Search team')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Team & access views' })).toHaveCount(0);
  } finally {
    await owner.close();
  }
});
