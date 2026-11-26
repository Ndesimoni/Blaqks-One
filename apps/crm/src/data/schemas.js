import { clientsColumns, contactsColumns } from './schemas/people.js';
import { propertiesColumns } from './schemas/properties.js';
import { dealsColumns, expensesColumns, paymentsColumns } from './schemas/deals.js';
import {
  clientCareColumns,
  followUpsColumns,
  interactionLogColumns,
  shortlistColumns,
  viewingsColumns,
} from './schemas/activity.js';

/** Workbook data sheets in their original order; each sheet's columns live in ./schemas/. */
export const WORKBOOK_SCHEMAS = {
  Clients: clientsColumns,
  Contacts: contactsColumns,
  Properties: propertiesColumns,
  Deals: dealsColumns,
  'Follow-ups': followUpsColumns,
  Viewings: viewingsColumns,
  Shortlist: shortlistColumns,
  'Interaction log': interactionLogColumns,
  'Client care': clientCareColumns,
  Payments: paymentsColumns,
  Expenses: expensesColumns,
};
