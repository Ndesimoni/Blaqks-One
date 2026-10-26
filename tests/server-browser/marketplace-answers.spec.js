import { expect, test } from './fixtures.js';
import { client, postHeld, requestTeams } from '../api/marketplace-request-helpers.mjs';
import { held } from '../api/record-sharing-helpers.mjs';
import { memberPage, noPageOverflow, openSection } from './assign-helpers.js';

test('brokers offer a property, message without a match, and reopen after selection', async ({
  browser,
}, testInfo) => {
  test.setTimeout(300000);
  const teams = await requestTeams('market-answers-browser');
  const person = await client(teams, 'one');
  await postHeld(teams.one, person.id);
  const listing = {
    property_id: 'MARKET-ANSWER-HOME',
    listing_title: 'Synthetic matching apartment',
    sale_rental: 'Rental',
    property_type: 'Apartment',
    bedrooms: '2',
    price_annual_rent_aed: '110000',
    listing_status: 'Available',
    emirate: 'Dubai',
    community: 'Dubai Marina',
    unit_reference: 'PRIVATE-UNIT-MK3',
  };
  const property = await held(teams.other, teams.agent, 'Properties', listing);
  const replacement = await held(teams.other, teams.agent, 'Properties', {
    ...listing,
    property_id: 'MARKET-ANSWER-SECOND',
    listing_title: 'Synthetic replacement apartment',
  });
  const poster = await memberPage(browser, teams.one.user.email);
  const broker = await memberPage(browser, teams.agent.user.email);
  const asking = await memberPage(browser, teams.colleague.user.email);
  try {
    for (const actor of [poster, broker, asking]) await openSection(actor.page, 'Marketplace');
    const boardCard = (page) =>
      page.locator('.market-board-card', { hasText: teams.one.user.name }).first();
    await boardCard(asking.page).getByRole('button', { name: 'Offers and messages' }).click();
    let dialog = asking.page.getByRole('dialog');
    await expect(
      dialog.getByText('You have no eligible matching property for this request.'),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Message the requesting broker' }).click();
    await dialog
      .getByRole('textbox', { name: 'Message', exact: true })
      .fill('Would a nearby area work for this request?');
    await dialog.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(dialog.getByText('Would a nearby area work for this request?')).toBeVisible();
    await dialog
      .getByRole('textbox', { name: 'Message', exact: true })
      .fill('Unsent broker question');
    asking.page.once('dialog', (prompt) => prompt.dismiss());
    await asking.page.keyboard.press('Escape');
    await expect(dialog.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue(
      'Unsent broker question',
    );
    asking.page.once('dialog', (prompt) => prompt.accept());
    await asking.page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(
      boardCard(asking.page).getByRole('button', { name: 'Offers and messages' }),
    ).toBeFocused();

    await boardCard(broker.page).getByRole('button', { name: 'Offers and messages' }).click();
    dialog = broker.page.getByRole('dialog');
    await dialog.getByRole('combobox', { name: 'Choose a property' }).selectOption(property.id);
    await dialog.getByRole('button', { name: 'Review property offer' }).click();
    await expect(dialog.getByRole('button', { name: 'Send property offer' })).toBeDisabled();
    await dialog.getByRole('checkbox', { name: /I checked the property details/ }).check();
    await dialog.getByRole('button', { name: 'Send property offer' }).click();
    await expect(dialog.getByText('1 of 3 active offers')).toBeVisible();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();

    await poster.page.getByRole('tab', { name: 'My requests' }).click();
    await poster.page.getByRole('button', { name: 'Offers and messages' }).click();
    dialog = poster.page.getByRole('dialog');
    await expect(dialog.getByText('PRIVATE-UNIT-MK3')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Not a match', exact: true }).click();
    await poster.page
      .getByRole('dialog')
      .getByRole('button', { name: 'Confirm', exact: true })
      .click();
    await expect(poster.page.getByRole('dialog').getByText('0 of 3 active offers')).toBeVisible();
    await poster.page
      .getByRole('dialog')
      .getByRole('button', { name: 'Close', exact: true })
      .click();
    await broker.page.getByRole('tab', { name: 'Updates' }).click();
    await broker.page
      .getByRole('button', { name: 'Offers and messages', exact: true })
      .first()
      .click();
    dialog = broker.page.getByRole('dialog');
    await dialog.getByRole('combobox', { name: 'Choose a property' }).selectOption(replacement.id);
    await dialog.getByRole('button', { name: 'Review property offer' }).click();
    await dialog.getByRole('checkbox', { name: /I checked the property details/ }).check();
    await dialog.getByRole('button', { name: 'Send property offer' }).click();
    await expect(dialog.getByText('1 of 3 active offers')).toBeVisible();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await poster.page.getByRole('button', { name: 'Offers and messages', exact: true }).click();
    dialog = poster.page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Proceed with this property' })).toBeVisible();
    for (const width of [390, 1280])
      for (const theme of ['dark', 'light']) {
        await poster.page.setViewportSize({ width, height: 900 });
        await poster.page.evaluate(
          (value) => document.documentElement.setAttribute('data-theme', value),
          theme,
        );
        await noPageOverflow(poster.page);
        await poster.page.screenshot({
          path: testInfo.outputPath(`marketplace-offers-${width}-${theme}.png`),
        });
      }
    await dialog.getByRole('button', { name: 'Proceed with this property' }).click();
    await poster.page
      .getByRole('dialog')
      .getByRole('button', { name: 'Confirm', exact: true })
      .click();
    dialog = poster.page.getByRole('dialog');
    await expect(
      dialog.getByText('Paused: proceeding with a property', { exact: true }),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();

    await asking.page.getByRole('tab', { name: 'Updates' }).click();
    await expect(
      asking.page.getByText('The requesting broker is proceeding with another property.'),
    ).toBeVisible();
    await asking.page.getByRole('button', { name: 'Open request update' }).first().click();
    await expect(
      asking.page.getByRole('button', { name: 'Send message', exact: true }),
    ).toHaveCount(0);
    await asking.page
      .getByRole('dialog')
      .getByRole('button', { name: 'Close', exact: true })
      .click();

    await poster.page.getByRole('button', { name: 'Offers and messages' }).click();
    await poster.page.getByRole('button', { name: 'Still available — reopen request' }).click();
    await poster.page
      .getByRole('dialog')
      .getByRole('button', { name: 'Confirm', exact: true })
      .click();
    await expect(poster.page.getByRole('dialog').getByText('0 of 3 active offers')).toBeVisible();
  } finally {
    for (const actor of [poster, broker, asking]) await actor.context.close();
  }
});
