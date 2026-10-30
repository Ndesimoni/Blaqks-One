/** Pure rules for the Admin's website enquiries list (50 per page, newest first). */
export const PAGE_SIZE = 50;
const CHANNELS = ['email', 'phone', 'whatsapp'];

/** The shared Pagination counts from 0; the API counts pages from 1. */
export const apiPage = (index) => Math.max(0, Math.trunc(Number(index) || 0)) + 1;
export const viewPage = (page) => Math.max(1, Math.trunc(Number(page) || 1)) - 1;

/** One page of the API response, normalised; unknown shapes become an empty page. */
export function readEnquiries(result) {
  const pagination = result?.pagination || {};
  return {
    rows: Array.isArray(result?.data) ? result.data : [],
    total: Number.isSafeInteger(pagination.total) ? pagination.total : 0,
    page: viewPage(pagination.page),
  };
}

/** Company site when the enquiry came through this company's own website. */
export const siteKind = (enquiry, companySiteId) =>
  companySiteId && enquiry?.siteId === companySiteId ? 'companySite' : 'generalSite';

/** Public listing titles by publication id, from the company's website listings. */
export function listingTitles(publications) {
  return new Map(
    (Array.isArray(publications) ? publications : [])
      .map((publication) => [publication?.id, String(publication?.snapshot?.title || '').trim()])
      .filter(([id, title]) => id && title),
  );
}

/** `{ title }` for a known listing, otherwise the catalogue key for the generic label. */
export function aboutLabel(enquiry, titles = new Map()) {
  if (!enquiry?.listingId) return { key: 'companyEnquiry' };
  const title = titles.get(enquiry.listingId);
  return title ? { title } : { key: 'propertyEnquiry' };
}

/**
 * An ISO instant from the API's PostgreSQL text ("2026-10-30 08:15:02.5+00"), which not
 * every browser parses; '' when it cannot be read.
 */
export function enquiryInstant(text) {
  if (typeof text !== 'string' || !text.trim()) return '';
  const iso = text
    .trim()
    .replace(' ', 'T')
    .replace(/\.(\d+)/, (_, digits) => `.${digits.padEnd(3, '0').slice(0, 3)}`);
  const date = new Date(/T.*[+-]\d{2}$/.test(iso) ? `${iso}:00` : iso);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

/** Email and phone the visitor gave, in that order. */
export const contactParts = (enquiry) =>
  [enquiry?.enquiry?.email, enquiry?.enquiry?.phone].filter(
    (value) => typeof value === 'string' && value.trim(),
  );

/** The stated contact preference, when it is one the catalogue names. */
export function preference(enquiry) {
  const value = String(enquiry?.enquiry?.contactPreference || '').toLowerCase();
  return CHANNELS.includes(value) ? value : '';
}

/** `{ name }` for a current member, otherwise the key for You, Not assigned or Former member. */
export function assigneeLabel(id, names, userId) {
  if (!id) return { key: 'unassigned' };
  if (id === userId) return { key: 'you' };
  const name = names?.get(id);
  return name ? { name } : { key: 'formerMember' };
}

/** The visitor's name, or a dash when the payload has none. */
export const senderName = (enquiry) => String(enquiry?.enquiry?.name || '').trim() || '—';
