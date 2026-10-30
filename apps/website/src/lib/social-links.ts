// Social media links (docs/website-social-links.md): the website re-checks every link with
// the same rules as services/crm-api/src/sites/social.rs and drops failures one at a time,
// so a bad stored link never breaks a page (review SOC1 H1).
import type { Agent, SocialField, SocialLinks } from './types.ts';
import { NETWORKS, REDIRECTS, RESERVED, SHORTENERS, SOCIAL_FIELDS } from './social-hosts.ts';

const under = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/** Percent-decodes until nothing changes, so a doubly encoded `https://` is still found. */
function unwrapped(text: string): string {
  for (let round = 0; round < 4; round++) {
    const next = new URLSearchParams(`v=${text.replaceAll('&', '%26')}`).get('v') ?? '';
    if (next === text) break;
    text = next;
  }
  return text;
}

function hidesAddress(url: URL): boolean {
  return [...url.searchParams.values()].some((value) => {
    const text = unwrapped(value);
    return text.includes('://') || text.startsWith('//');
  });
}

/** Whether `value` is an acceptable, canonical link for `field`. */
export function socialLink(field: string, value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length > 300 ||
    !value.startsWith('https://') ||
    /[\s\p{Cc}\\]/u.test(value)
  )
    return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const host = url.hostname,
    labels = host.split('.'),
    last = labels[labels.length - 1];
  // A canonical IPv4 address ends in a numeric label; IPv6 hosts are bracketed.
  if (
    url.href !== value ||
    url.username ||
    url.password ||
    url.port ||
    host.startsWith('[') ||
    /^\d+$/.test(last) ||
    labels.length < 2 ||
    labels.some((label) => !label || label.startsWith('xn--')) ||
    hidesAddress(url)
  )
    return false;
  if (field === 'website')
    return !RESERVED.includes(last) && !SHORTENERS.some((short) => under(host, short));
  const network = NETWORKS.find(([name]) => name === field);
  if (!network) return false;
  const [, domains, subdomains] = network;
  const path = url.pathname.toLowerCase();
  return (
    !REDIRECTS.some((prefix) => path.startsWith(prefix)) &&
    domains.some((domain) => {
      if (host === domain) return true;
      if (!host.endsWith(`.${domain}`)) return false;
      const sub = host.slice(0, -domain.length - 1);
      return subdomains.includes(sub) || (field === 'linkedin' && /^[a-z]{2}$/.test(sub));
    })
  );
}

/** The links safe to show, in display order; anything else is dropped alone, never thrown. */
export function publicSocial(value: unknown): SocialLinks | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  const kept = SOCIAL_FIELDS.filter(
    (field) => Object.hasOwn(row, field) && socialLink(field, row[field]),
  ).map((field) => [field, row[field] as string]);
  return kept.length ? (Object.fromEntries(kept) as SocialLinks) : undefined;
}

/** The entries to render, re-checked, in display order. */
export function socialEntries(links: SocialLinks | undefined): [SocialField, string][] {
  const kept = publicSocial(links);
  return kept ? (Object.entries(kept) as [SocialField, string][]) : [];
}

/** A member's own Other website never appears on the general site (review SOC1 H2). */
export function withoutWebsite(links: SocialLinks | undefined): SocialLinks | undefined {
  const rest = { ...links };
  delete rest.website;
  return Object.keys(rest).length ? rest : undefined;
}

/** Applies H2 to every agent shown on the general site. */
export function dropMemberWebsites(agents: Agent[]): void {
  for (const agent of agents) {
    const links = withoutWebsite(agent.social);
    if (links) agent.social = links;
    else delete agent.social;
  }
}

/** The visible name of an Other website: its host, without a leading `www.` (review L1). */
export function websiteHost(value: string): string {
  return new URL(value).hostname.replace(/^www\./, '');
}
