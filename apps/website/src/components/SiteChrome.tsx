import Link from 'next/link';
import type { Site } from '../lib/types';
import { initials } from './ui';
import { MobileMenu } from './MobileMenu';
import { SocialLinkList } from './SocialLinkList';

export function SiteHeader({ site }: { site: Site }) {
  const links = [
    ['/properties', 'Properties'],
    ['/developers', 'Developers'],
    ...(site.kind === 'platform'
      ? [
          ['/companies', 'Companies'],
          ['/agents', 'Agents'],
        ]
      : [['/agents', 'Our people']]),
    ['/about', 'About'],
    ['/contact', 'Contact'],
  ];
  return (
    <header className="site-header">
      <Link className="wordmark" href="/" aria-label={`${site.name} home`}>
        <span className="brand-mark" aria-hidden="true">
          {site.kind === 'platform' ? 'B' : initials(site.name)}
        </span>
        <span>
          {site.name}
          <small>
            {site.kind === 'platform'
              ? 'A considered way to find home.'
              : 'Property. With a personal perspective.'}
          </small>
        </span>
      </Link>
      <nav className="desktop-nav" aria-label="Main navigation">
        {links.map(([href, label]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
      </nav>
      <MobileMenu links={links} />
    </header>
  );
}
export function SiteFooter({ site }: { site: Site }) {
  return (
    <footer className="site-footer">
      <div>
        <Link className="footer-brand" href="/">
          {site.name}
        </Link>
        <p>
          Places to belong.
          <br />
          People to guide you.
        </p>
        <SocialLinkList links={site.social} owner={site.name} sample={site.sample} />
      </div>
      <div>
        <p className="eyebrow">EXPLORE</p>
        <Link href="/properties">All properties</Link>
        <Link href="/developers">UAE developers</Link>
        <Link href="/agents">{site.kind === 'platform' ? 'Meet the agents' : 'Our people'}</Link>
      </div>
      <div>
        <p className="eyebrow">GET IN TOUCH</p>
        <Link href="/about">About us</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/areas">Neighbourhoods</Link>
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} {site.name}
        </span>
        <Link href="/privacy">Privacy notice</Link>
        <Link href="/terms">Website terms</Link>
      </div>
    </footer>
  );
}
