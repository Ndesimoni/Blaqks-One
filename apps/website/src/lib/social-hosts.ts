// The hosts and paths social links may use, kept identical to the CRM API's
// services/crm-api/src/sites/social_hosts.rs (docs/website-social-links.md §3, review SOC1
// M2 and L2): profile hosts per network, never link shims or redirect pages, and no reserved
// names or URL shorteners for the "Other website" link.
import type { SocialField } from './types.ts';

/** Display order on the websites. */
export const SOCIAL_FIELDS: readonly SocialField[] = [
  'instagram',
  'facebook',
  'tiktok',
  'linkedin',
  'youtube',
  'x',
  'website',
];
export const SOCIAL_NAMES: Record<SocialField, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  x: 'X',
  website: 'Website',
};
/** Network, its domains and the subdomains allowed in front of them (never link shims). */
export const NETWORKS: readonly (readonly [SocialField, readonly string[], readonly string[]])[] = [
  ['instagram', ['instagram.com'], ['www', 'm']],
  ['facebook', ['facebook.com', 'fb.com'], ['www', 'm', 'mobile']],
  ['tiktok', ['tiktok.com'], ['www', 'm', 'vm', 'vt']],
  ['linkedin', ['linkedin.com'], ['www', 'm', 'mobile']],
  ['youtube', ['youtube.com', 'youtu.be'], ['www', 'm']],
  ['x', ['x.com', 'twitter.com'], ['www', 'm', 'mobile']],
];
export const REDIRECTS = [
  '/l.php',
  '/redirect',
  '/redir',
  '/url',
  '/link/',
  '/attribution_link',
  '/i/redirect',
];
export const RESERVED = [
  'local',
  'localhost',
  'internal',
  'test',
  'example',
  'invalid',
  'onion',
  'arpa',
];
export const SHORTENERS = [
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'rb.gy',
  'cutt.ly',
  'lnkd.in',
  'tiny.cc',
  's.id',
];
