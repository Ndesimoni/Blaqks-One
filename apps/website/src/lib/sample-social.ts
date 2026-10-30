// Illustrative social links for the fictional sample sites (review SOC1 L4). The handles are
// invented and the "Other website" uses the reserved example.com domain; sample mode shows
// them without links, so a preview never sends a visitor to a stranger's account.
import type { SocialField, SocialLinks } from './types.ts';

type Network = Exclude<SocialField, 'website'>;
const profile: Record<Network, string> = {
  instagram: 'https://www.instagram.com/',
  facebook: 'https://www.facebook.com/',
  tiktok: 'https://www.tiktok.com/@',
  linkedin: 'https://www.linkedin.com/company/',
  youtube: 'https://www.youtube.com/@',
  x: 'https://x.com/',
};

function sample(slug: string, networks: Network[], website = false, person = false) {
  const links: SocialLinks = {};
  for (const network of networks)
    links[network] =
      person && network === 'linkedin'
        ? `https://www.linkedin.com/in/blaqks-sample-${slug}`
        : `${profile[network]}blaqks-sample-${slug}`;
  if (website) links.website = `https://www.example.com/${slug}`;
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
