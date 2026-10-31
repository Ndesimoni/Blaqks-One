import { expect } from './fixtures.js';
import { market } from '../api/marketplace-helpers.mjs';
import { client, postHeld, requestTeams } from '../api/marketplace-request-helpers.mjs';
import { held } from '../api/record-sharing-helpers.mjs';

/** A selected, still-sealed marketplace offer; actual selection is through the API. */
export async function selectedMarketplaceOffer() {
  const teams = await requestTeams('mk4-browser');
  const customer = await client(teams, 'one');
  const request = await postHeld(teams.one, customer.id);
  const property = await held(teams.other, teams.agent, 'Properties', {
    property_id: 'MK4-BROWSER',
    listing_title: 'Private MK4 apartment',
    sale_rental: 'Rental',
    property_type: 'Apartment',
    emirate: 'Dubai',
    community: 'Dubai Marina',
    bedrooms: '2',
    area_sq_ft: '1200',
    listing_status: 'Available',
    price_annual_rent_aed: '110000',
    unit_reference: 'MK4-PRIVATE-UNIT',
    address: 'Private MK4 address',
  });
  const preview = await market(teams.agent, `/requests/${request.id}/offers/preview`, {
    method: 'POST',
    body: { recordId: property.id },
  });
  expect(preview.status, JSON.stringify(preview.value)).toBe(200);
  const offer = await market(teams.agent, `/requests/${request.id}/offers`, {
    method: 'POST',
    body: { recordId: property.id, previewDigest: preview.value.previewDigest, checked: true },
  });
  expect(offer.status, JSON.stringify(offer.value)).toBe(201);
  const detail = await market(teams.one, `/requests/${request.id}/offers`);
  const selected = await market(teams.one, `/requests/${request.id}/select`, {
    method: 'POST',
    body: { answerId: detail.value.answers[0].id, expectedVersion: detail.value.request.version },
  });
  expect(selected.status, JSON.stringify(selected.value)).toBe(200);
  return { teams, request, customer };
}

export async function draftMarketplaceAgreement(page) {
  await page.getByRole('button', { name: 'Prepare co-broking agreement' }).click();
  const form = page.getByRole('dialog');
  await expect(form.getByLabel('Client name', { exact: true })).toHaveCount(0);
  await expect(form.getByLabel('Share client contact details')).toHaveCount(0);
  await form.getByRole('button', { name: 'Next', exact: true }).click();
  await form.getByLabel('Agreed amount (AED)').fill('12000');
  await form.getByLabel('Fee collected by').selectOption('sender');
  await form.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(form).toContainText('Marketplace client');
  await form.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.agreement-status')).toContainText('Draft');
}
