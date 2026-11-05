/**
 * The hosts and paths social links may use, mirroring services/crm-api/src/sites/social_hosts.rs
 * (docs/website-social-links.md §3, review SOC1 M2 and L2). The server stays the authority.
 */

/** Network → its domains and the profile subdomains allowed in front of them. */
export const NETWORKS = {
  instagram: { domains: ['instagram.com'], subdomains: ['www', 'm'] },
  facebook: { domains: ['facebook.com', 'fb.com'], subdomains: ['www', 'm', 'mobile'] },
  tiktok: { domains: ['tiktok.com'], subdomains: ['www', 'm', 'vm', 'vt'] },
  linkedin: { domains: ['linkedin.com'], subdomains: ['www', 'm', 'mobile'] },
  youtube: { domains: ['youtube.com', 'youtu.be'], subdomains: ['www', 'm'] },
  x: { domains: ['x.com', 'twitter.com'], subdomains: ['www', 'm', 'mobile'] },
};

/** Link shims and redirect pages a network link may not point at. */
export const REDIRECTS = [
  '/l.php',
  '/redirect',
  '/redir',
  '/url',
  '/link/',
  '/attribution_link',
  '/i/redirect',
];

/** Top-level names that never reach a real public website. */
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

/** URL shorteners hide where a link goes, so Other website refuses them. */
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
