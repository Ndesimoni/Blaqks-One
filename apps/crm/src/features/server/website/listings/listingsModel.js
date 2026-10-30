/**
 * The company's website listings (docs/website-backend.md, "Selected property publication").
 * A publication freezes the public facts; a later CRM edit raises the record's version above
 * `sourceVersion`, so it shows "Changes not public" until someone republishes.
 */
export const PAGE_SIZE = 12;
export const LISTING_FILTERS = ['live', 'withdrawn', 'all'];
const EMIRATE_NAMES = {
  dubai: 'Dubai',
  'abu-dhabi': 'Abu Dhabi',
  sharjah: 'Sharjah',
  ajman: 'Ajman',
  'umm-al-quwain': 'Umm Al Quwain',
  'ras-al-khaimah': 'Ras Al Khaimah',
  fujairah: 'Fujairah',
};
export const emirateName = (slug) => EMIRATE_NAMES[slug] || '';

/** `withdrawn`, `changed` (live, CRM edits not public) or `live`. */
export function listingStatus(publication, entry) {
  if (!publication?.active) return 'withdrawn';
  if (entry && entry.version > publication.sourceVersion) return 'changed';
  return 'live';
}
export const isLive = (status) => status === 'live' || status === 'changed';

export const publishedAt = (publication) =>
  publication?.publishedAt || publication?.snapshot?.publishedAt || '';

/** Publications joined with the CRM entry they came from (null when no longer visible). */
export function listingRows(publications, entries) {
  const properties = entries?.Properties || [];
  return (publications || []).map((publication) => {
    const entry = properties.find((item) => item.id === publication.recordId) || null;
    const snapshot = publication.snapshot || {};
    return {
      publication,
      entry,
      status: listingStatus(publication, entry),
      title: snapshot.title || entry?.record?.listing_title || '',
      area: [entry?.record?.community, emirateName(snapshot.emirate)].filter(Boolean).join(' · '),
      price: Number(snapshot.price) || 0,
      purpose: snapshot.purpose || '',
      publishedAt: publishedAt(publication),
    };
  });
}

export function filterListings(rows, { query = '', status = 'all' } = {}) {
  const needle = query.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (status === 'all' || (status === 'live' ? isLive(row.status) : row.status === status)) &&
      (!needle || row.title.toLowerCase().includes(needle)),
  );
}

/** The catalogue key for a public price: total for sales, per year for rent, per night. */
export const priceKey = (purpose) =>
  purpose === 'rent' ? 'priceYear' : purpose === 'holiday' ? 'priceNight' : 'priceTotal';

/**
 * A property's website state for its details panel: the newest live publication, or the
 * newest withdrawn one (republishing reuses its version), or none.
 */
export function recordWebsite(publications, entry) {
  if (!entry) return { status: 'none', publication: null, live: [] };
  const own = (publications || []).filter((row) => row.recordId === entry.id);
  const live = own.filter((row) => row.active);
  const publication = live[0] || own[0] || null;
  if (!live.length) return { status: 'none', publication, live };
  return { status: listingStatus(live[0], entry), publication: live[0], live };
}

/** Properties that are live on the website, for marking choices in the publish picker. */
export const liveRecordIds = (publications) =>
  new Set((publications || []).filter((row) => row.active).map((row) => row.recordId));
