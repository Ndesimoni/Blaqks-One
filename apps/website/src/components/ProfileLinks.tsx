import Link from 'next/link';
import type { Agent, Company, Developer } from '../lib/types';
import { ContactLinks } from './ui';
import { SocialLinkList } from './SocialLinkList';

export function ProfileLinks({
  page,
  id,
  agent,
  company,
  developer,
  sample,
}: {
  page: string;
  id: string;
  agent?: Agent;
  company?: Company;
  developer?: Developer;
  sample: boolean;
}) {
  return (
    <>
      {page === 'company' && (
        <Link className="button quiet" href={`/enquiry?company=${encodeURIComponent(id)}`}>
          Enquire with this company →
        </Link>
      )}
      {agent && (
        <>
          <p>{company?.name}</p>
          <ContactLinks agent={agent} />
          <SocialLinkList
            links={agent.social}
            owner={agent.name}
            label={`${agent.name} on social media`}
            sample={sample}
          />
          <Link className="button quiet" href={`/enquiry?agent=${encodeURIComponent(agent.id)}`}>
            Send an enquiry →
          </Link>
        </>
      )}
      {developer?.website && (
        <a href={developer.website} target="_blank" rel="noopener noreferrer">
          Visit developer website <span className="sr-only">(opens in a new tab)</span> →
        </a>
      )}
    </>
  );
}
