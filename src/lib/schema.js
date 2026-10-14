import { WORKBOOK_SCHEMAS } from '../data/schemas.js';
import {
  OPTIONS,
  computedByModule,
  dateRegex,
  fieldPlaceholders,
  longRegex,
  numRegex,
} from '../config/fields.js';
import { slug } from './records.js';

const MODS = WORKBOOK_SCHEMAS;

const computed = (mod, label) => (computedByModule[mod] || []).includes(label);

function colType(l) {
  if (numRegex.test(l) || /share %|score \//i.test(l)) return 'number';
  if (dateRegex.test(l)) return /time/i.test(l) ? 'datetime-local' : 'date';
  if (/email/i.test(l)) return 'email';
  if (/url|\bmap link\b/i.test(l)) return 'url';
  if (/phone/i.test(l)) return 'tel';
  if (longRegex.test(l)) return 'textarea';
  return 'text';
}

const richField = (m, f) => ({
  ...f,
  key: slug(f.name),
  type: colType(f.name),
  calculated: computed(m, f.name),
  options: OPTIONS[f.name] || null,
  ...(fieldPlaceholders[f.name] && { placeholder: fieldPlaceholders[f.name] }),
});

const schema = (m) => (MODS[m] || []).map((f) => richField(m, f));

const blank = () => Object.fromEntries(Object.keys(MODS).map((k) => [k, []]));

const identifier = (mod) =>
  ({
    Clients: 'CL',
    Contacts: 'CT',
    Properties: 'PR',
    Deals: 'DL',
    'Follow-ups': 'FU',
    Viewings: 'VW',
    Shortlist: 'MT',
    'Interaction log': 'LG',
    'Client care': 'CA',
    Payments: 'PM',
    Expenses: 'EX',
  })[mod] || 'RC';

const newId = (mod, records) => {
  const prefix = identifier(mod);
  const first = slug(schema(mod)[0].name);
  const used = new Set(records.map((r) => String(r[first] || '')));
  let i = records.length + 1;
  while (used.has(`${prefix}-${String(i).padStart(3, '0')}`)) i++;
  return `${prefix}-${String(i).padStart(3, '0')}`;
};

export { MODS, computed, colType, richField, schema, blank, identifier, newId };
