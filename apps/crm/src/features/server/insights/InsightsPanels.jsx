import React from 'react';
import { leadTier } from '../../../lib/crm.js';
import { get, initials } from '../../../lib/records.js';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Empty } from '../../../components/ui/Empty.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { TitleSection } from '../../../components/ui/TitleSection.jsx';
import { ShareBars } from './ShareBars.jsx';
import { sumOf } from './shareModel.js';

export { LeadTiers } from './LeadQuality.jsx';

export function PipelineMix({ pipelines, total, team }) {
  const typed = sumOf(pipelines);
  return (
    <section className="panel insight-panel" aria-label="Active pipelines">
      <TitleSection
        heading="Active pipelines"
        caption={team ? 'Deal mix across your team' : 'Deal mix across the deals you can see'}
      />
      {typed === 0 ? (
        <Empty
          title="No pipeline mix yet"
          detail="Record a pipeline type on deals to see how your business is split."
          icon="briefcase"
        />
      ) : (
        <ShareBars
          rows={pipelines}
          total={total}
          label="Deals by pipeline"
          unit={['deal', 'deals']}
        />
      )}
    </section>
  );
}

/** Deal insights while the scoped finance view loads, or after it failed. */
export function DealsPending({ finance }) {
  return (
    <section className="panel insight-panel" aria-label="Active pipelines">
      <TitleSection heading="Active pipelines" caption="Deal mix from the deals you can see" />
      {finance.loading ? (
        <div className="insight-skeleton" role="status">
          <span className="sr-only">Loading deals…</span>
          {[70, 45, 30].map((width) => (
            <span key={width} style={{ width: `${width}%` }} aria-hidden="true" />
          ))}
        </div>
      ) : (
        <div className="insight-error">
          <p className="field-error" role="alert">
            Deal insights could not be loaded. {finance.error}
          </p>
          <Button variant="light" onClick={finance.retry}>
            Retry
          </Button>
        </div>
      )}
    </section>
  );
}

export function LostReasons({ reasons, withDeals }) {
  return (
    <section className="panel insight-panel" aria-label="Lost lead intelligence">
      <TitleSection
        heading="Lost lead intelligence"
        caption={
          withDeals ? 'Why clients and deals did not convert' : 'Why clients did not convert'
        }
      />
      {reasons.length ? (
        <ShareBars rows={reasons} total={sumOf(reasons)} label="Lost reasons" />
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
    <section className="panel insight-panel" aria-label="Needs qualification">
      <TitleSection
        heading="Needs qualification"
        caption="Clients missing confirmed funds or a decision maker"
      />
      <div className="qualify-list">
        {clients.map((client) => (
          <button
            key={get(client, 'Client ID')}
            type="button"
            className="client-mini qualify-row"
            onClick={() => onOpen(client)}
          >
            <span className="avatar">{initials(get(client, 'Full name'))}</span>
            <div>
              <strong>{get(client, 'Full name')}</strong>
              <small>{get(client, 'Preferred communities') || 'Area not specified'}</small>
            </div>
            <Badge>{leadTier(client)}</Badge>
            <Icon name="chevron" size={16} />
          </button>
        ))}
      </div>
      {clients.length === 0 && (
        <Empty
          title="Every profile is complete"
          detail="Every client in view has a complete buyer profile."
          icon="check"
        />
      )}
    </section>
  );
}
