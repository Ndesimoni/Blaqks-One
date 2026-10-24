/**
 * The budget bands the board shows instead of a client's exact budget (packet MK2). The edges
 * mirror the server's `bands.rs`, so the form can show the band while the member types; the
 * server still decides the band it stores.
 */
const BUY = [
  ['buy_1m', 1_000_000],
  ['buy_2m', 2_000_000],
  ['buy_3m', 3_000_000],
  ['buy_5m', 5_000_000],
  ['buy_10m', 10_000_000],
  ['buy_10m_plus', Number.MAX_SAFE_INTEGER],
];
const RENT = [
  ['rent_50k', 50_000],
  ['rent_100k', 100_000],
  ['rent_150k', 150_000],
  ['rent_250k', 250_000],
  ['rent_500k', 500_000],
  ['rent_500k_plus', Number.MAX_SAFE_INTEGER],
];

/** The band a maximum budget falls in. */
export function bandFor(purpose, maximum) {
  if (!Number.isSafeInteger(maximum) || maximum <= 0) return '';
  const table = purpose === 'rent' ? RENT : BUY;
  const found = table.find(([, limit]) => maximum <= limit);
  return found ? found[0] : '';
}

/** Whole dirhams from what a member typed or a client stored: separators go, fils are dropped. */
export function wholeDirhams(value) {
  const whole = String(value ?? '').split('.')[0];
  const text = whole.replace(/[^0-9]/g, '');
  return text ? Number(text) : null;
}
