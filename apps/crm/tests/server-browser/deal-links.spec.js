import { test, expect } from './fixtures.js';
import {
  createDeal,
  financeDealTeam,
  heldClient,
  memberPage,
  openDeal,
  openDeals,
} from './finance-deals-fixtures.js';
import { saveRecordForm } from './assign-helpers.js';
import {
  createLog,
  DEAL_FIELD,
  DEAL_LINK_MISSING,
  dealOptions,
  dealRef,
  detailDeal,
  editLog,
  insertLegacyLog,
  openLog,
  patchLog,
  UNAVAILABLE,
} from './deal-links-helpers.js';

// Interaction log deal links (finance-design §6.3, §17); all data is synthetic.
const listed = async (form, dealId) =>
  (await dealOptions(form)).some(
    (text) => text.startsWith(`${dealId} · `) && !text.endsWith(UNAVAILABLE),
  );

test('an Admin links a visible deal and must clear one that is unavailable', async ({
  browser,
}) => {
  const team = await financeDealTeam('dl-ui-admin');
  const ws = team.admin.user.id;
  const adminClient = await heldClient(team.admin);
  const deal = await createDeal(team.admin, adminClient);
  const agentDeal = await createDeal(team.agent, await heldClient(team.agent));
  const plain = (await createLog(team.admin, ws, adminClient)).record.log_id;
  insertLegacyLog(ws, 'LG-DLUI-GONE', adminClient, 'DL-GONE');
  const { page, context } = await memberPage(browser, team.people.admin.email);
  try {
    let details = await openLog(page, plain);
    await expect(detailDeal(details)).toHaveText('—');
    let form = await editLog(page, details);
    const field = form.getByLabel(DEAL_FIELD, { exact: true });
    await expect.poll(() => listed(form, agentDeal.dealId)).toBe(true);
    expect(await listed(form, deal.dealId)).toBe(true);
    expect((await dealOptions(form))[0]).toBe('No linked deal');
    await field.selectOption(deal.dealId);
    await saveRecordForm(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(dealRef(ws, plain)).toBe(deal.dealId);
    details = await openLog(page, plain);
    await expect(detailDeal(details)).toHaveText(deal.dealId);

    details = await openLog(page, 'LG-DLUI-GONE');
    await expect(detailDeal(details)).toHaveText(UNAVAILABLE);
    form = await editLog(page, details);
    await expect(form.getByLabel(DEAL_FIELD, { exact: true })).toHaveValue('DL-GONE');
    await expect(form.locator('#deal_id_optional option:checked')).toHaveText(
      `DL-GONE · ${UNAVAILABLE}`,
    );
    await saveRecordForm(page);
    const refusal = form.getByRole('alert').filter({ hasText: DEAL_LINK_MISSING.message });
    await expect(refusal).toBeVisible();
    await expect(form.locator('#deal_id_optional-error')).toHaveText(DEAL_LINK_MISSING.message);
    await expect(form.getByLabel(DEAL_FIELD, { exact: true })).toBeFocused();
    await form.getByLabel(DEAL_FIELD, { exact: true }).selectOption('');
    await saveRecordForm(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(dealRef(ws, 'LG-DLUI-GONE')).toBe('-');

    await openDeals(page);
    const dealDetails = await openDeal(page, deal.dealId);
    await dealDetails.getByRole('button', { name: 'Delete deal', exact: true }).click();
    const confirm = page.getByRole('dialog', { name: `Delete ${deal.dealId}?`, exact: true });
    await confirm.getByRole('button', { name: 'Delete deal', exact: true }).click();
    await expect(confirm.getByRole('alert')).toContainText('A linked record prevents this change.');
  } finally {
    await context.close();
  }
});

test('own-view and finance-less staff never see hidden deals and can keep or clear a link', async ({
  browser,
}) => {
  const team = await financeDealTeam('dl-ui-staff');
  const ws = team.admin.user.id;
  const adminDeal = await createDeal(team.admin, await heldClient(team.admin));
  const agentClient = await heldClient(team.agent);
  const agentDeal = await createDeal(team.agent, agentClient);
  const link = async (session, clientId) => {
    const log = await createLog(session, ws, clientId);
    const linked = await patchLog(team.admin, ws, log, { deal_id_optional: adminDeal.dealId });
    expect(linked.status).toBe(200);
    return log.record.log_id;
  };
  const agentLog = await link(team.agent, agentClient);
  const deskLog = await link(team.desk, await heldClient(team.desk));

  const agent = await memberPage(browser, team.people.agent.email);
  try {
    const details = await openLog(agent.page, agentLog);
    await expect(detailDeal(details)).toHaveText(UNAVAILABLE);
    const form = await editLog(agent.page, details);
    await expect.poll(() => listed(form, agentDeal.dealId)).toBe(true);
    const options = await dealOptions(form);
    expect(options).toContain(`${adminDeal.dealId} · ${UNAVAILABLE}`);
    expect(options.filter((text) => text.startsWith(`${adminDeal.dealId} · `))).toHaveLength(1);
    await form.getByLabel('Conversation topic', { exact: true }).fill('Agent kept link');
    await saveRecordForm(agent.page);
    await expect(agent.page.getByRole('dialog')).toHaveCount(0);
    expect(dealRef(ws, agentLog)).toBe(adminDeal.dealId);
  } finally {
    await agent.context.close();
  }

  const desk = await memberPage(browser, `dl-ui-staff-desk@team-fixture.test`);
  try {
    const details = await openLog(desk.page, deskLog);
    await expect(detailDeal(details)).toHaveText(UNAVAILABLE);
    const form = await editLog(desk.page, details);
    const field = form.getByLabel(DEAL_FIELD, { exact: true });
    await expect(field).toHaveJSProperty('tagName', 'INPUT');
    await expect(field).toHaveAttribute('readonly', '');
    await expect(field).toHaveValue(`${adminDeal.dealId} · ${UNAVAILABLE}`);
    await expect(
      form.getByText('Only members with finance access can choose a deal.'),
    ).toBeVisible();
    await form.getByRole('button', { name: 'Clear deal link', exact: true }).click();
    await expect(field).toHaveValue('No deal linked');
    await saveRecordForm(desk.page);
    await expect(desk.page.getByRole('dialog')).toHaveCount(0);
    expect(dealRef(ws, deskLog)).toBe('-');
  } finally {
    await desk.context.close();
  }
});
