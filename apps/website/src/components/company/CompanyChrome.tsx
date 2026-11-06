import Link from 'next/link';
import type { Site } from '../../lib/types';
import { CompanyNavigation } from './CompanyNavigation';
import { MobileMenu } from '../MobileMenu';
import { SocialLinkList } from '../SocialLinkList';

const links = [
  ['/properties', 'Properties'],
  ['/about', 'Company'],
  ['/services', 'Services'],
  ['/agents', 'Our people'],
  ['/contact', 'Contact'],
];
export function CompanyHeader({ site }: { site: Site }) {
  return (
    <div className="a-header-surface">
      <header className="a-header a-container">
        <Link className="a-wordmark" href="/" aria-label={`${site.name} home`}>
          <span>{site.name.replace(/ Realty$/, '').split(' & ')[0]}</span>
          <span>
            {site.name.includes(' & ')
              ? '& ' + site.name.replace(/ Realty$/, '').split(' & ')[1]
              : 'ESTATE'}
          </span>
        </Link>
        <CompanyNavigation links={links} />
        <Link className="a-header-contact" href="/contact">
          ↥ List your property
        </Link>
        <MobileMenu links={links} />
      </header>
    </div>
  );
}
export function CompanyFooter({ site }: { site: Site }) {
  return (
    <footer className="a-footer a-container">
      <div>
        <Link className="a-wordmark" href="/">
          <span>{site.name.replace(/ Realty$/, '')}</span>
          <small>REAL ESTATE · UAE</small>
        </Link>
        <p>
          A considered approach.
          <br />A place of your own.
        </p>
        <SocialLinkList links={site.social} owner={site.name} sample={site.sample} />
      </div>
      <div>
        <p className="a-kicker">EXPLORE</p>
        <Link href="/properties?purpose=buy">Buy a property</Link>
        <Link href="/properties?purpose=rent">Find a rental</Link>
        <Link href="/areas">Neighbourhoods</Link>
      </div>
      <div>
        <p className="a-kicker">COMPANY</p>
        <Link href="/about">Our story</Link>
        <Link href="/services">Our services</Link>
        <Link href="/agents">Meet the team</Link>
        <Link href="/contact">Get in touch</Link>
      </div>
      <div className="a-footer-bottom">
        <span>
          © {new Date().getFullYear()} {site.name}
        </span>
        <span>Powered by Blaqks One</span>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </div>
    </footer>
  );
}
