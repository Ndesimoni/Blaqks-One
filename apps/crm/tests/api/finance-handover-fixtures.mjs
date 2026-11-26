/** A deal whose client, property and owner contact carry private details the H2 review
 * preview must never show (agreements design §17 item 1, amendments 10 and 11). */
import assert from 'node:assert/strict';
import { createDeal } from './finance-deals-helpers.mjs';

/** Text the preview must never carry: free text, contact details and record IDs. */
export const SECRET = {
  notes: 'Zqx deal notes about the buyer',
  documents_url: 'https://docs.example.test/zqx-folder',
  current_blocker: 'Zqx blocker waiting on the buyer bank',
  next_deal_action: 'Zqx call the buyer at home',
};

/** A client, the property owner's contact and a property, each with private details, and
 * a deal over them with a partner company. Created by `agent`, who holds all of them. */
export async function richDeal(agent) {
  const make = async (collection, record) => {
    const path = `/workspaces/${agent.user.workspaceId}/records/${collection}`;
    const made = await agent.request(path, { method: 'POST', body: { record } });
    assert.equal(made.status, 201, JSON.stringify(made.value));
    return made.value;
  };
  const contact = await make('Contacts', {
    full_name: 'Synthetic Zqxowner',
    phone: '+971500000301',
    email: 'zqx.owner@example.test',
  });
  const client = await make('Clients', {
    full_name: 'Synthetic Zqxbuyer',
    phone: '+971500000302',
    email: 'zqx.buyer@example.test',
    notes: 'Zqx client private note',
  });
  const property = await make('Properties', {
    listing_title: 'Synthetic Marina View',
    contact_id: contact.record.contact_id,
    sale_rental: 'Sale',
    emirate: 'Dubai',
    community: 'Dubai Marina',
    building_project: 'Synthetic Tower',
    unit_reference: 'ZQX-UNIT-9',
    property_type: 'Apartment',
    bedrooms: '2',
    bathrooms: '3',
    area_sq_ft: '1250',
    price_annual_rent_aed: '2450000',
    ready_off_plan: 'Ready',
    furnishing: 'Furnished',
    notes: 'Zqx property private note',
  });
  const deal = await createDeal(agent, client.record.client_id, {
    propertyId: property.record.property_id,
    partnerShareBp: 1000,
    partnerName: 'Synthetic Partner Realty',
    details: {
      ...SECRET,
      opened_date: '2026-10-01',
      target_close_date: '2026-12-15',
      pipeline_milestone: 'Synthetic milestone',
      next_action_due: '2026-11-02',
    },
  });
  return { deal, client, contact, property };
}
