import Link from 'next/link';
import type { Agent, Area, Company, Developer, PageData } from '../lib/types';
import { AgentCard, PropertyGrid } from './Cards';
import { ProfileLinks } from './ProfileLinks';
import { Empty, Heading, initials } from './ui';

export function ProfilePage({ page, entity, catalogue }: PageData) {
  const id = entity!.id;
  const agent = page === 'agent' ? (entity as Agent) : undefined;
  const company =
    page === 'company'
      ? (entity as Company)
      : agent
        ? catalogue.companies.find((item) => item.id === agent.company)
        : undefined;
  const developer = page === 'developer' ? (entity as Developer) : undefined;
  const area = page === 'area' ? (entity as Area) : undefined;
  const stock = catalogue.listings.filter((item) =>
    page === 'agent'
      ? item.agent === id
      : page === 'company'
        ? item.company === id
        : page === 'developer'
          ? item.developer === id
          : item.area === id,
  );
  const name = (entity as Agent | Area | Company | Developer).name;
  const collection = {
    agent: ['/agents', 'Agents'],
    company: ['/companies', 'Companies'],
    developer: ['/developers', 'Developers'],
    area: ['/areas', 'Communities'],
  }[page]!;
  const filter =
    page === 'agent'
      ? 'agent'
      : page === 'company'
        ? 'company'
        : page === 'developer'
          ? 'developer'
          : 'area';
  return (
    <section className="section page-top">
      <p className="breadcrumb">
        <Link href={collection[0]}>← {collection[1]}</Link>
      </p>
      <div className="profile-intro">
        <div>
          <span className="avatar large" aria-hidden="true">
            {company && page === 'company' ? company.mark : initials(name)}
          </span>
          <Heading
            eyebrow={
              agent?.specialty || (developer ? 'UAE DEVELOPER' : area ? area.city : company?.area)
            }
            title={name}
            text={
              company?.note ||
              area?.note ||
              (developer
                ? 'Explore the properties represented by companies on this website.'
                : undefined)
            }
          />
          {entity && 'publicListingCount' in entity && entity.publicListingCount !== undefined && (
            <p>{entity.publicListingCount} public listings</p>
          )}
          {page === 'company' && company?.publicAgentCount !== undefined && (
            <p>{company.publicAgentCount} agents with public listings</p>
          )}
          <ProfileLinks page={page} id={id} agent={agent} company={company} developer={developer} />
        </div>
        <div className="profile-copy">
          <p className="eyebrow">PROPERTIES & PERSPECTIVE</p>
          <h2>
            {agent
              ? 'Property advice. A personal perspective.'
              : area
                ? 'A setting for your next chapter.'
                : developer
                  ? 'Discover what is available.'
                  : 'A considered approach to your next move.'}
          </h2>
          <p className="muted">
            {developer
              ? 'Property enquiries go to the listing agent and the company representing the property. A developer profile does not imply a partnership or endorsement.'
              : area
                ? area.note
                : 'Browse the public listings below and contact the representative for property information and availability.'}
          </p>
          {catalogue.listings.some((item) => item.developerIllustrative) && developer && (
            <p className="notice">
              Developer-property associations in this sample are illustrative. These are not actual
              developer listings.
            </p>
          )}
        </div>
      </div>
      <div className="section-heading">
        <h2>
          {agent
            ? `Properties represented by ${agent.name.split(' ')[0]}.`
            : 'Properties to explore.'}
        </h2>
        <Link href={`/properties?${filter}=${encodeURIComponent(id)}`}>
          View all matching properties →
        </Link>
      </div>
      {stock.length ? (
        <PropertyGrid listings={stock} catalogue={catalogue} />
      ) : (
        <Empty
          title="No properties published here yet."
          text="This profile has no matching listings on this website."
        />
      )}
      {page === 'company' && (
        <>
          <div className="section-heading">
            <h2>Meet the people.</h2>
          </div>
          <div className="people-grid">
            {catalogue.agents
              .filter((item) => item.company === id)
              .map((item) => (
                <AgentCard key={item.id} agent={item} catalogue={catalogue} />
              ))}
          </div>
        </>
      )}
    </section>
  );
}
