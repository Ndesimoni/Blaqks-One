import { test, expect } from './fixtures.js';
import {
  checkLayout,
  createDeal,
  financeDealTeam,
  heldClient,
  layouts,
  memberPage,
  openDeal,
  openDeals,
} from './finance-deals-fixtures.js';

const sidebar = (page) => page.getByRole('navigation', { name: 'CRM sections' });
const waiting = (count) => `Deals, ${count} hand-over${count === 1 ? '' : 's'} waiting for you`;

test('a hand-over that needs approval moves only after the receiver accepts and the Admin approves', async ({
  browser,
}) => {
  const team = await financeDealTeam('fin-ui-appr');
  const { admin, agent, second } = team.people;
  const deal = await createDeal(team.agent, await heldClient(team.agent));
  const holder = await memberPage(browser, agent.email);
  await openDeals(holder.page);
  const details = await openDeal(holder.page, deal.dealId);
  await details.getByRole('button', { name: 'Hand over', exact: true }).click();
  const offer = holder.page.getByRole('dialog', { name: 'Hand over deal' });
  // The Admin can receive a deal, as a full hand-over with no approval step (§17 item 3).
  await offer.getByLabel('Hand over to').selectOption({ label: `${admin.name} (Admin)` });
  await expect(offer.getByLabel('Keep a referral share')).toBeDisabled();
  await expect(offer.getByLabel('Needs approval')).toHaveCount(0);
  await expect(offer).toContainText('no agent commission is earned');
  await offer.getByLabel('Hand over to').selectOption({ label: second.name });
  await offer.getByLabel('Needs approval').check();
  const approver = offer.getByLabel('Approver');
  await expect(approver).toHaveValue(admin.id);
  await expect(approver.locator('option', { hasText: second.name })).toHaveCount(0);
  await expect(offer).toContainText(`After ${second.name} accepts and ${admin.name} approves`);
  await offer.getByRole('button', { name: 'Send hand-over request' }).click();
  await expect(offer).toHaveCount(0);
  await details.getByRole('button', { name: 'Close deal details' }).click();
  const outgoing = holder.page.getByRole('region', { name: 'Hand-over requests' });
  await expect(outgoing).toContainText(`Waiting for ${second.name} to respond`);
  await expect(outgoing).toContainText(`Needs approval by ${admin.name}`);

  // The receiver's Deals badge counts the offer; the review shows the deal, not the client.
  const receiver = await memberPage(browser, second.email);
  await expect(sidebar(receiver.page).getByRole('button', { name: waiting(1) })).toBeVisible();
  await openDeals(receiver.page);
  const incoming = receiver.page.getByRole('region', { name: 'Hand-over requests' });
  await incoming
    .getByRole('button', { name: `Review offer for hand-over of ${deal.dealId}` })
    .click();
  const review = receiver.page.getByRole('dialog', { name: 'Review the hand-over offer' });
  await expect(review).toContainText(`After you accept, ${admin.name} approves`);
  await expect(review).toContainText('Offer open until');
  await expect(review).not.toContainText('Synthetic finance client');
  await review.getByRole('button', { name: 'Accept offer' }).click();
  await expect(review).toHaveCount(0);
  await expect(incoming).toContainText(`Waiting for ${admin.name} to approve`);
  await expect(
    sidebar(receiver.page).getByRole('button', { name: 'Deals', exact: true }),
  ).toBeVisible();
  await expect(receiver.page.getByRole('heading', { name: 'No deals yet' })).toBeVisible();

  // The Admin, as the chosen approver, reviews and approves; only then does the deal move.
  const owner = await memberPage(browser, admin.email);
  await expect(sidebar(owner.page).getByRole('button', { name: waiting(1) })).toBeVisible();
  await openDeals(owner.page);
  const queue = owner.page.getByRole('region', { name: 'Hand-over requests' });
  await expect(queue).toContainText(`${second.name} accepted the offer from ${agent.name}`);
  await queue
    .getByRole('button', { name: `Review hand-over of ${deal.dealId} for approval` })
    .click();
  const approval = owner.page.getByRole('dialog', { name: 'Approve the hand-over' });
  await expect(approval).toContainText(`${second.name} accepted on`);
  await expect(approval.getByRole('button', { name: 'Reject', exact: true })).toBeEnabled();
  for (const layout of layouts) await checkLayout(owner.page, layout, 'deal-handover-approval');
  await owner.page.setViewportSize({ width: 1280, height: 900 });
  await approval.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(approval).toHaveCount(0);
  await expect(queue).toHaveCount(0);
  await expect(
    sidebar(owner.page).getByRole('button', { name: 'Deals', exact: true }),
  ).toBeVisible();

  await receiver.page.reload();
  await expect(receiver.page.getByRole('region', { name: 'Hand-over requests' })).toHaveCount(0);
  const moved = await openDeal(receiver.page, deal.dealId);
  await expect(moved).toContainText(`${second.name} (you)`);
  for (const session of [holder, receiver, owner]) await session.context.close();
});
