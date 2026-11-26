// Sample social links for the fictional sample sites (review SOC1 L4). Each opens the
// network's own home page and the "Other website" the reserved example.com, so a preview
// never sends a visitor to a stranger's account (owner asked for clickable samples).
import type { SocialField, SocialLinks } from './types.ts';

type Network = Exclude<SocialField, 'website'>;
const home: Record<Network, string> = {
  instagram: 'https://www.instagram.com/',
  facebook: 'https://www.facebook.com/',
  tiktok: 'https://www.tiktok.com/',
  linkedin: 'https://www.linkedin.com/',
  youtube: 'https://www.youtube.com/',
  x: 'https://x.com/',
};

// `_slug` and `_person` keep the call sites readable; every sample opens a home page.
function sample(_slug: string, networks: Network[], website = false, _person = false) {
  const links: SocialLinks = {};
  for (const network of networks) links[network] = home[network];
  if (website) links.website = 'https://www.example.com/';
  return links;
}

export const sampleSiteSocial: Record<string, SocialLinks> = {
  platform: sample('general', ['instagram', 'linkedin', 'youtube', 'x'], true),
  harbour: sample('harbour', ['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'x'], true),
  cedar: sample('cedar', ['instagram', 'facebook', 'linkedin'], true),
  dune: sample('dune', ['instagram', 'tiktok', 'x']),
};

export const sampleAgentSocial: Record<string, SocialLinks> = {
  maya: sample('maya', ['instagram', 'linkedin'], true, true),
  adam: sample('adam', ['linkedin'], false, true),
  leila: sample('leila', ['instagram', 'facebook']),
  sara: sample('sara', ['instagram', 'tiktok', 'youtube']),
  james: sample('james', ['linkedin', 'x'], true, true),
};
