import React from 'react';
import { COLORS } from '../../../config/theme.js';
import { leadTier } from '../../../lib/crm.js';
import { get, initials } from '../../../lib/records.js';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Empty } from '../../../components/ui/Empty.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { TitleSection } from '../../../components/ui/TitleSection.jsx';

const share = (value, total) => `${(value / total) * 100}%`;

export function LeadTiers({ tiers, total }) {
  return (
    <section className="panel" aria-label="Lead quality distribution">
      <TitleSection
        heading="Lead quality distribution"
        caption="Automatic tiers from the clients in view"
      />
      <div className="tier-list">
        {tiers.map((tier, index) => (
          <div key={tier.title} className="tier-item">
            <div
              className="tier-icon"
              style={{ background: `${COLORS[index]}24`, color: COLORS[index] }}
            >
              <Icon name={index === 0 ? 'sparkle' : index === 4 ? 'close' : 'users'} size={17} />
            </div>
            <span>{tier.title}</span>
            <div className="tier-track" aria-hidden="true">
              <div style={{ background: COLORS[index], width: share(tier.value, total) }} />
            </div>
            <strong>{tier.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PipelineMix({ pipelines, total, team }) {
  return (
    <section className="panel" aria-label="Active pipelines">
      <TitleSection
        heading="Active pipelines"
        caption={team ? 'Deal mix across your team' : 'Deal mix across the deals you can see'}
      />
      <div className="pipeline-list">
        {pipelines.map((row, index) => (
          <div className="bar-row" key={row.name}>
            <div className="bar-label">
              <span>{row.name}</span>
              <strong>{row.value}</strong>
            </div>
            <div className="bar-track" aria-hidden="true">
              <div
                style={{
                  width: share(row.value, total),
                  background: COLORS[index % COLORS.length],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LostReasons({ reasons, withDeals }) {
  return (
    <section className="panel" aria-label="Lost lead intelligence">
      <TitleSection
        heading="Lost lead intelligence"
        caption={
          withDeals ? 'Why clients and deals did not convert' : 'Why clients did not convert'
        }
      />
      {reasons.length ? (
        reasons.map((reason) => (
          <div className="lost-reason" key={reason.name}>
            <span>{reason.name}</span>
            <Badge tone="amber">
              {reason.value} {reason.value === 1 ? 'record' : 'records'}
            </Badge>
          </div>
        ))
      ) : (
        <Empty
          title="No lost reasons yet"
          detail="Record a reason whenever a lead doesn't progress."
          icon="target"
        />
      )}
    </section>
  );
}

export function NeedsQualification({ clients, onOpen }) {
  return (
    <section className="panel" aria-label="Needs qualification">
      <TitleSection
        heading="Needs qualification"
        caption="Clients with incomplete buyer profiles"
      />
      {clients.map((client) => (
        <button
          key={get(client, 'Client ID')}
          type="button"
          className="client-mini"
          onClick={() => onOpen(client)}
        >
          <span className="avatar">{initials(get(client, 'Full name'))}</span>
          <div>
            <strong>{get(client, 'Full name')}</strong>
            <small>{get(client, 'Preferred communities') || 'Area not specified'}</small>
          </div>
          <Badge>{leadTier(client)}</Badge>
        </button>
      ))}
      {clients.length === 0 && (
        <Empty detail="Every client in view has a complete buyer profile." />
      )}
    </section>
  );
}
