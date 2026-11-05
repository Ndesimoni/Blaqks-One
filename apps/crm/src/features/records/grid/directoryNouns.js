/** One noun per collection: the record word used by the count, presets and the primary action. */
const nouns = {
  Clients: 'client',
  Contacts: 'contact',
  Deals: 'deal',
  'Follow-ups': 'follow-up',
  Viewings: 'viewing',
  'Client care': 'touchpoint',
  'Interaction log': 'conversation',
  Payments: 'payment',
  Expenses: 'expense',
  Shortlist: 'match',
};

export const directoryNoun = (module) => nouns[module] || 'record';

/** English plural of a directory noun: "match" becomes "matches", "client" becomes "clients". */
export function plural(noun) {
  if (/s$/.test(noun)) return noun;
  return /(x|ch|sh)$/.test(noun) ? `${noun}es` : `${noun}s`;
}
