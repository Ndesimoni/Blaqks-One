import { NETWORKS, REDIRECTS, RESERVED, SHORTENERS } from './socialHosts.js';

/**
 * Social media links for the company, platform and member profiles
 * (docs/website-social-links.md). A light client check of services/crm-api/src/sites/social.rs:
 * the form sends each link in its canonical `new URL(value).href` form and the server
 * re-checks it.
 */
export const SOCIAL_FIELDS = [...Object.keys(NETWORKS), 'website'];
export const MAX_LINK = 300;

const under = (host, domain) => host === domain || host.endsWith(`.${domain}`);

/** A scheme such as `https:` or `javascript:`, but not a host followed by a port. */
const hasScheme = (text) => /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(text);

/** Percent-decodes a few times, so a doubly encoded address is still found. */
function unwrapped(text) {
  let value = text;
  for (let round = 0; round < 4; round += 1) {
    let next;
    try {
      next = decodeURIComponent(value);
    } catch {
      break;
    }
    if (next === value) break;
    value = next;
  }
  return value;
}

/** A query value that carries another address, such as `?u=https://elsewhere`. */
const hidesAddress = (url) =>
  [...url.searchParams.values()].some((raw) => {
    const value = unwrapped(raw);
    return value.includes('://') || value.startsWith('//');
  });

/** Trims, adds `https://` when no scheme was typed and returns the parser's canonical form. */
export function normalize(field, text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed || !SOCIAL_FIELDS.includes(field)) return trimmed;
  try {
    return new URL(hasScheme(trimmed) ? trimmed : `https://${trimmed}`).href;
  } catch {
    return trimmed;
  }
}

function networkHost(field, host, path) {
  const { domains, subdomains } = NETWORKS[field];
  if (REDIRECTS.some((prefix) => path.startsWith(prefix))) return false;
  return domains.some((domain) => {
    if (host === domain) return true;
    if (!host.endsWith(`.${domain}`)) return false;
    const sub = host.slice(0, -domain.length - 1);
    return subdomains.includes(sub) || (field === 'linkedin' && /^[a-z]{2}$/.test(sub));
  });
}

/**
 * The catalogue key (`instagramInvalid`, `websiteInvalid` …) when `value` is not an
 * acceptable canonical link for `field`; '' when it is acceptable or empty.
 */
export function socialError(field, value) {
  const text = String(value ?? '');
  if (!text) return '';
  const key = `${field}Invalid`;
  if (
    !SOCIAL_FIELDS.includes(field) ||
    text.length > MAX_LINK ||
    !text.startsWith('https://') ||
    /[\s\\\p{Cc}]/u.test(text)
  )
    return key;
  let url;
  try {
    url = new URL(text);
  } catch {
    return key;
  }
  const host = url.hostname;
  const labels = host.split('.');
  if (
    url.href !== text ||
    url.username ||
    url.password ||
    url.port ||
    host.startsWith('[') ||
    /^[\d.]+$/.test(host) ||
    labels.length < 2 ||
    labels.some((label) => !label || label.startsWith('xn--')) ||
    hidesAddress(url)
  )
    return key;
  if (field === 'website')
    return RESERVED.includes(labels.at(-1)) || SHORTENERS.some((short) => under(host, short))
      ? key
      : '';
  return networkHost(field, host, url.pathname.toLowerCase()) ? '' : key;
}

/** Form values, one string per field. */
export function fromSocial(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(
    SOCIAL_FIELDS.map((field) => [field, typeof source[field] === 'string' ? source[field] : '']),
  );
}

/** Each typed link checked as it would be sent; only the fields with a problem. */
export function socialErrors(values) {
  const source = values || {};
  return Object.fromEntries(
    SOCIAL_FIELDS.map((field) => [
      field,
      socialError(field, normalize(field, source[field])),
    ]).filter(([, key]) => key),
  );
}

/** The `social` object to send: canonical links without empty fields, or `undefined`. */
export function toSocial(values) {
  const source = values || {};
  const links = SOCIAL_FIELDS.map((field) => [field, normalize(field, source[field])]).filter(
    ([, link]) => link,
  );
  return links.length ? Object.fromEntries(links) : undefined;
}
