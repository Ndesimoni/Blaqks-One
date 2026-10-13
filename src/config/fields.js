import { stageAndListingOptions } from './fields/stageAndListingOptions.js';
import { clientAndContactOptions } from './fields/clientAndContactOptions.js';
import { outcomeAndCareOptions } from './fields/outcomeAndCareOptions.js';

/** Dropdown options by workbook field name, in their original order. */
const OPTIONS = {
  ...stageAndListingOptions,
  ...clientAndContactOptions,
  ...outcomeAndCareOptions,
};

const computedByModule = {
  Clients: [
    'Duplicate contact',
    'Last contact auto',
    'Next follow-up auto',
    'Follow-up status auto',
    'Record check',
    'Lead tier auto',
  ],
  Deals: [
    'Gross fee AED ex VAT',
    'After partner AED',
    'Your expected fee AED',
    'Your earned fee AED',
    'Outstanding AED',
    'Payment status',
    'Record check',
  ],
  Properties: ['Availability review', 'Permit date alert', 'Record check'],
  'Follow-ups': [
    'Due-date alert',
    'Client name auto',
    'Property title auto',
    'Record check',
    'Task order auto',
  ],
  Viewings: ['Client name auto', 'Property title auto', 'Record check'],
  Shortlist: ['Client name auto', 'Property title auto', 'Record check'],
  Payments: ['Total received AED', 'Record check'],
  'Interaction log': ['Client name auto', 'Record check auto'],
  'Client care': ['Client name auto', 'Reminder auto', 'Record check auto'],
  Contacts: ['Record check'],
  Expenses: ['Record check'],
};

const numRegex =
  /\b(AED|sq ft|budget|bedrooms|bathrooms|parking spaces|amount|cheques|fee rate|share %|score \/|deposit|nights|guests)\b/i;

const dateRegex =
  /(date|\bdue\b|expires|expiry|last verified|received on|contacted on|added on|next contact|last contact|next follow-up|last qualified|closed on|re-engage|opened|earned|payment due|available from)/i;

const longRegex =
  /(notes|summary|criteria|objection|commitment|description|feedback|blocker|interests|amenities|selling points|instructions)/i;

export { OPTIONS, computedByModule, numRegex, dateRegex, longRegex };
