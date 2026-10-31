const slug = (str) =>
  String(str || '')
    .toLowerCase()
    .replace(/[\n\r]+/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

const get = (rec, label) => rec?.[slug(label)];

const initials = (t) =>
  String(t || 'K')
    .split(/\s+/)
    .slice(0, 2)
    .map((v) => v[0])
    .join('')
    .toUpperCase();

const tidy = (s) => String(s || '').replaceAll('_', ' ');

const isDone = (s) => /^(completed|closed|done|paid|cancelled|lost|sold)$/i.test(String(s || ''));

const isLost = (s) => /lost|cancelled/i.test(String(s || ''));

const prName = (data, id) =>
  get(
    data.Properties.find((p) => get(p, 'Property ID') === id),
    'Listing title',
  ) ||
  id ||
  '—';

const clName = (data, id) =>
  get(
    data.Clients.find((p) => get(p, 'Client ID') === id),
    'Full name',
  ) ||
  id ||
  '—';

const amountOf = (r, label) => Number(get(r, label)) || 0;

const SUM = (items, fn) => items.reduce((s, r) => s + fn(r), 0);

export { slug, get, initials, tidy, isDone, isLost, prName, clName, amountOf, SUM };
