import type { SocialLinks } from '../lib/types';
import { SOCIAL_NAMES } from '../lib/social-hosts';
import { socialEntries, websiteHost } from '../lib/social-links';
import { SocialIcon } from './SocialIcons';

// Social media links (docs/website-social-links.md): network icons with full accessible
// names, the Other website by its host name, and plain text only, never inserted HTML. Sample
// links open each network's home page and are labelled as samples (review SOC1 L4).
export function SocialLinkList({
  links,
  owner,
  label = 'Social media',
  title,
  labelled = false,
  sample = false,
}: {
  links?: SocialLinks;
  owner: string;
  label?: string;
  title?: string;
  labelled?: boolean;
  sample?: boolean;
}) {
  const entries = socialEntries(links);
  if (!entries.length) return null;
  const items = entries.map(([field, url]) => {
    const website = field === 'website';
    const content = (
      <>
        <SocialIcon field={field} />
        <span className="sr-only">{website ? `${owner} website: ` : `${owner} on `}</span>
        <span className={labelled || website ? 'social-text' : 'sr-only'}>
          {website ? websiteHost(url) : SOCIAL_NAMES[field]}
        </span>
        <span className="sr-only">
          {sample ? ' (sample link, opens in a new tab)' : ' (opens in a new tab)'}
        </span>
      </>
    );
    return (
      <li key={field}>
        <a
          className="social-item"
          href={url}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
        >
          {content}
        </a>
      </li>
    );
  });
  const body = (
    <>
      {title && <p className="eyebrow">{title}</p>}
      <ul>{items}</ul>
      {sample && (
        <small className="social-note">Sample links: they open each network's home page.</small>
      )}
    </>
  );
  const className = labelled ? 'social-links labelled' : 'social-links';
  return (
    <nav className={className} aria-label={sample ? `${label} (sample)` : label}>
      {body}
    </nav>
  );
}
