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
  shoot,
} from './finance-deals-fixtures.js';

test('a holder offers a deal keeping a referral share and the teammate accepts it', async ({
  browser,
}) => {
  const team = await financeDealTeam('fin-ui-hand');
  const { agent, second } = team.people;
  const deal = await createDeal(team.agent, await heldClient(team.agent));
  const holder = await memberPage(browser, agent.email);
  await openDeals(holder.page);
  let details = await openDeal(holder.page, deal.dealId);
  await details.getByRole('button', { name: 'Hand over', exact: true }).click();
  const offer = holder.page.getByRole('dialog', { name: 'Hand over deal' });
  const send = offer.getByRole('button', { name: 'Send hand-over request' });
  await expect(send).toBeDisabled();
  await offer.getByLabel('Hand over to').selectOption({ label: second.name });
  await offer.getByLabel('Keep a referral share').check();
  await offer.getByLabel('Referral share %').fill('25');
  await send.click();
  await expect(offer.getByRole('alert')).toContainText(
    "The referral share is above your team's limit.",
  );
  await expect(offer.getByLabel('Referral share %')).toHaveValue('25');
  await offer.getByLabel('Referral share %').fill('10');
  await expect(offer).toContainText(`After ${second.name} accepts`);
  for (const layout of layouts) await checkLayout(holder.page, layout, 'deal-handover-offer');
  await holder.page.setViewportSize({ width: 1280, height: 900 });
  await send.click();
  await expect(offer).toHaveCount(0);
  await expect(details).toContainText('A hand-over of this deal is waiting for a response.');
  await expect(details.getByRole('button', { name: 'Hand over', exact: true })).toHaveCount(0);
  await details.getByRole('button', { name: 'Close deal details' }).click();
  const outgoing = holder.page.getByRole('region', { name: 'Hand-over requests' });
  await expect(outgoing).toContainText(`Waiting for ${second.name} to respond`);
  await expect(outgoing).toContainText(`${agent.name} keeps a 10% referral share`);
  await expect(
    outgoing.getByRole('button', { name: `Cancel request hand-over of ${deal.dealId}` }),
  ).toBeVisible();

  const receiver = await memberPage(browser, second.email);
  await openDeals(receiver.page);
  await expect(receiver.page.getByRole('heading', { name: 'No deals yet' })).toBeVisible();
  const incoming = receiver.page.getByRole('region', { name: 'Hand-over requests' });
  await expect(incoming).toContainText(`${agent.name} offers you this deal`);
  await expect(incoming).toContainText(`${deal.dealId} · Sale · Offer`);
  await expect(incoming).not.toContainText('AED');
  await expect(
    incoming.getByRole('button', { name: `Cancel request hand-over of ${deal.dealId}` }),
  ).toHaveCount(0);
  for (const layout of layouts) await checkLayout(receiver.page, layout, 'deal-handover-incoming');
  await receiver.page.setViewportSize({ width: 1280, height: 900 });
  // The receiver reviews the full offer (agreements design §14–§15) and accepts that version.
  await incoming.getByRole('button', { name: `Accept hand-over of ${deal.dealId}` }).click();
  const review = receiver.page.getByRole('dialog', { name: 'Review the hand-over offer' });
  await expect(review).toContainText('Deal fee');
  await expect(review).toContainText('No property is linked to this deal.');
  await expect(review).toContainText('Share of the receiving agent’s commission');
  for (const layout of layouts) await checkLayout(receiver.page, layout, 'deal-handover-review');
  await receiver.page.setViewportSize({ width: 1280, height: 900 });
  await review.getByRole('button', { name: 'Accept offer' }).click();
  await expect(review).toHaveCount(0);
  await expect(incoming).toHaveCount(0);
  details = await openDeal(receiver.page, deal.dealId);
  await expect(details.getByRole('region', { name: 'Commission' })).toContainText(
    `Shared with ${agent.name}`,
  );
  await expect(details).toContainText(`${second.name} (you)`);

  await holder.page.reload();
  await expect(holder.page.locator('.page-heading h1')).toHaveText('Deals & commissions');
  await expect(holder.page.getByRole('heading', { name: 'No deals yet' })).toBeVisible();
  await expect(holder.page.getByRole('region', { name: 'Hand-over requests' })).toHaveCount(0);
  // The accepted hand-over is kept under Agreements, decided only from Deals.
  await details.getByRole('button', { name: 'Close deal details' }).click();
  await receiver.page
    .getByRole('navigation', { name: 'CRM sections' })
    .getByRole('button', { name: 'Agreements', exact: true })
    .click();
  await receiver.page
    .getByRole('button', { name: /In-company/ })
    .first()
    .click();
  const kept = receiver.page.getByRole('dialog');
  await expect(kept).toContainText('Accepted');
  await expect(kept.getByRole('button', { name: 'Accept' })).toHaveCount(0);
  await expect(kept).not.toContainText('Another company');
  await receiver.page.waitForTimeout(400);
  await shoot(receiver.page, 'deal-handover-agreement');
  await holder.context.close();
  await receiver.context.close();
});
