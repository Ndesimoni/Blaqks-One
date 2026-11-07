import Link from 'next/link';
import type { Site } from '../lib/types';
import { EnquiryForm } from './EnquiryForm';
import { SocialLinkList } from './SocialLinkList';
import { CompanySampleForm } from './company/CompanySampleForm';

export function InfoContact({ site }: { site: Site }) {
  return (
    <div className="contact-layout">
      <div className="prose">
        <p className="eyebrow">A PERSONAL INTRODUCTION</p>
        <h2>Start with the right conversation.</h2>
        <p>
          {site.content?.contactText ||
            'Tell us what you are looking for and the right person will follow up. For a specific property, you can also contact its named listing agent from the property page.'}
        </p>
        <Link className="button quiet" href="/agents">
          Find a representative →
        </Link>
        <SocialLinkList
          links={site.social}
          owner={site.name}
          label={`${site.name} on social media`}
          title="FOLLOW US"
          labelled
          sample={site.sample}
        />
      </div>
      <div className="contact-form-panel">
        {site.kind === 'company' && !site.sample ? (
          <EnquiryForm companyId={site.company || undefined} />
        ) : (
          <CompanySampleForm actionClass="button" />
        )}
      </div>
    </div>
  );
}
