import Link from 'next/link';
import type { Agent, Company, Developer } from '../lib/types';
import { ContactLinks } from './ui';

export function ProfileLinks({
  page,
  id,
  agent,
  company,
  developer,
}: {
  page: string;
  id: string;
  agent?: Agent;
  company?: Company;
  developer?: Developer;
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
