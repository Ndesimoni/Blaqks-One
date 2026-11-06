import Link from 'next/link';
import type { Site } from '../../lib/types';
import { CompanyNavigation } from '../company/CompanyNavigation';
import { CompanyFooter } from '../company/CompanyChrome';
import { MobileMenu } from '../MobileMenu';
import { HomeverseIcon } from './HomeverseIcon';
const links = [
  ['/', 'Home'],
  ['/about', 'About us'],
  ['/properties', 'Properties'],
  ['/services', 'Services'],
  ['/agents', 'Our team'],
  ['/contact', 'Contact'],
];
export function HomeverseHeader({ site }: { site: Site }) {
  return (
    <div className="v-header-surface">
      <header className="a-header a-container">
        <Link href="/" className="v-brand" aria-label={`${site.name} home`}>
          <HomeverseIcon />
          <span>
            {site.name}
            <small>REAL ESTATE</small>
          </span>
        </Link>
        <CompanyNavigation links={links} />
        <Link className="v-button" href="/contact">
          Get in touch <span aria-hidden="true">↗</span>
        </Link>
        <MobileMenu links={links} />
      </header>
    </div>
  );
}
export function HomeverseFooter({ site }: { site: Site }) {
  return (
    <div className="v-footer-surface">
      <CompanyFooter site={site} />
    </div>
  );
}
