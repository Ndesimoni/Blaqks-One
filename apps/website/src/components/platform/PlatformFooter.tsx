import Link from 'next/link';
import type { Site } from '../../lib/types';
import { crmEntry } from '../../lib/crm-entry';
import { SocialLinkList } from '../SocialLinkList';

export function PlatformFooter({ site }: { site: Site }) {
  const crm = crmEntry();
  return (
    <footer className="platform-footer">
      <div className="platform-footer-top section">
        <div>
          <p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
          <h2>
            Find a place.
            <br />
            Make a connection.
          </h2>
          <Link className="button" href="/properties">
            Explore our properties ↗
          </Link>
        </div>
        <div className="platform-footer-columns">
          <div>
            <h3>Discover</h3>
            <Link href="/properties?purpose=buy">Buy a property</Link>
            <Link href="/properties?purpose=rent">Rent a home</Link>
            <Link href="/properties?category=commercial">Commercial property</Link>
            <Link href="/deals">Property deals</Link>
            <Link href="/areas">Neighbourhoods</Link>
          </div>
          <div>
            <h3>For professionals</h3>
            <Link href="/agents">Agents</Link>
            <Link href="/companies">Real estate companies</Link>
            <Link href="/developers">UAE developers</Link>
            <a href={crm || '/professionals'}>CRM sign in</a>
            <Link href="/professionals">Create your workspace</Link>
          </div>
          <div>
            <h3>How can we help?</h3>
            <Link href="/about">About Blaqks One</Link>
            <Link href="/contact">Contact us</Link>
            <Link href="/privacy">Privacy notice</Link>
            <Link href="/terms">Terms & conditions</Link>
          </div>
        </div>
      </div>
      <div className="section platform-footer-bottom">
        <div>
          <Link className="footer-brand" href="/">
            {site.name}
          </Link>
          <p>A considered way to discover properties and the professionals behind them.</p>
          <SocialLinkList links={site.social} owner={site.name} sample={site.sample} />
        </div>
        <small>
          © {new Date().getFullYear()} {site.name}. All rights reserved.
        </small>
      </div>
    </footer>
  );
}
