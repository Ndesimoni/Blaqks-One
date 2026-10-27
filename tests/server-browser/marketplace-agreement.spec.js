import { test, expect } from './fixtures.js';
import { memberPage, openSection } from './assign-helpers.js';
import { confirmAction, openAgreements, shots } from './agreements-helpers.js';
import {
  selectedMarketplaceOffer,
  draftMarketplaceAgreement,
} from './marketplace-agreement-helpers.js';

test('a selected offer releases private details only after negotiated agreement acceptance', async ({
  browser,
}, testInfo) => {
  test.setTimeout(300000);
  const { teams, customer } = await selectedMarketplaceOffer();
  const poster = await memberPage(browser, teams.one.user.email);
  const broker = await memberPage(browser, teams.agent.user.email);
  try {
    await openSection(poster.page, 'Marketplace');
    await poster.page.getByRole('tab', { name: 'My requests', exact: true }).click();
    await poster.page.getByRole('button', { name: 'Offers and messages', exact: true }).click();
    await expect(poster.page.getByRole('dialog')).not.toContainText('MK4-PRIVATE-UNIT');
    await draftMarketplaceAgreement(poster.page);
    await expect(poster.page.getByRole('dialog')).not.toContainText('MK4-PRIVATE-UNIT');
    await confirmAction(poster.page, 'Send offer', 'Send offer', 'Sent');
    await poster.page.getByRole('button', { name: 'Close agreement', exact: true }).click();
    await expect(poster.page.getByRole('dialog')).not.toContainText('MK4-PRIVATE-UNIT');
    await expect(poster.page.getByRole('link', { name: 'Chat on WhatsApp' })).toHaveCount(0);

    await openAgreements(broker.page);
    await broker.page.locator('.agreement-row').first().click();
    await expect(broker.page.getByRole('dialog')).not.toContainText('MK4-PRIVATE-UNIT');
    await expect(broker.page.getByRole('dialog')).not.toContainText(customer.record.full_name);
    await confirmAction(broker.page, 'Accept', 'Accept agreement', 'Accepted');
    await broker.page.getByRole('button', { name: 'Close agreement', exact: true }).click();

    await poster.page.getByRole('button', { name: 'Refresh activity', exact: true }).click();
    await expect(poster.page.getByRole('dialog')).toContainText('MK4-PRIVATE-UNIT');
    await expect(poster.page.getByRole('dialog')).toContainText('Private MK4 address');
    await expect(poster.page.getByRole('link', { name: 'Chat on WhatsApp' })).toBeVisible();
    await shots(poster.page, testInfo, 'marketplace-release');
    await poster.page.getByRole('button', { name: 'Review agreement', exact: true }).click();
    await confirmAction(poster.page, 'Mark completed', 'Mark completed', 'Completed');
    await poster.page.getByRole('button', { name: 'Close agreement', exact: true }).click();
    await poster.page
      .getByRole('dialog')
      .getByRole('button', { name: 'Close', exact: true })
      .click();
    await poster.page
      .getByRole('button', { name: 'Preview how others see me', exact: true })
      .click();
    const stats = poster.page.getByRole('region', { name: 'Marketplace record', exact: true });
    await expect(stats).toContainText('100%');
    await expect(stats).toContainText('Completed deals');
    await expect(stats).toContainText('Dispute statistics are not available yet.');
  } finally {
    await poster.context.close();
    await broker.context.close();
  }
});
