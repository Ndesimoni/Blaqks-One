import { factKeys } from './listingShareModel.js';

/**
 * Links, WhatsApp and dates for listing shares (docs/record-sharing.md R2): the link holds
 * only the share's ID in the fragment, and the WhatsApp text names only the sender.
 */
export const LISTING_SHARE_ROUTE = 'Shared listing';
const ID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const LINK = new RegExp(`^/listing-shares/(${ID})$`);
const UUID = new RegExp(`^${ID}$`);

/** The listing as the shared listing view shows it: every known fact, null when absent. */
export const toProperty = (facts, photos = [], floorPlans = []) => ({
  ...Object.fromEntries(factKeys.map((key) => [key, facts?.[key] ?? null])),
  photos,
  floorPlans,
});

/** The share ID of an exact `/listing-shares/{uuid}` route, or null for any other path. */
export const listingShareLinkId = (pathname) => LINK.exec(pathname || '')?.[1] ?? null;
export const listingShareRoute = (pathname) =>
  listingShareLinkId(pathname) ? LISTING_SHARE_ROUTE : null;

/** The link the agent opens: only the share's ID, and only in the fragment. */
export const listingShareLink = (origin, id) => {
  if (!UUID.test(id)) throw new Error('Invalid listing share.');
  return `${origin}/#/listing-shares/${id}`;
};

/** The WhatsApp message: the sender's name and the link only, never the listing's facts. */
export const listingWhatsAppText = (t, sender, link) =>
  t('listingShares.whatsApp', { name: sender, link });

/** A Dubai day `days` from now, as the date field and the server expect it. */
export const dubaiDay = (days, now = Date.now()) =>
  new Date(now + 4 * 3600e3 + days * 86400e3).toISOString().slice(0, 10);
