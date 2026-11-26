import { selectInsights } from './selectors.js';
import { leadTier } from '../../lib/crm.js';
import { get, initials } from '../../lib/records.js';
import { Metric } from '../../components/ui/Metric.jsx';
import { TitleSection } from '../../components/ui/TitleSection.jsx';
import { COLORS } from '../../config/theme.js';
import { Icon } from '../../components/ui/Icon.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Empty } from '../../components/ui/Empty.jsx';
import React from 'react';
import { useRecords, useWorkspaceActions } from '../../hooks/useWorkspace.js';

function InsightsPage() {
  const { data, summary } = useRecords();
  const { dispatchRow } = useWorkspaceActions();

  const { counts, total, pipelineTypes, lostReasons } = selectInsights(data);
  return (
    <div className="page-stack">
      <div className="metrics-grid">
        <Metric
          name="HOT LEADS"
          value={summary.hot.length}
          sub="High qualification score"
          icon="sparkle"
          accent="mint"
        />
        <Metric
          name="WARM LEADS"
          value={summary.warm.length}
          sub="Require further nurturing"
          icon="users"
          accent="sand"
        />
        <Metric
          name="FOLLOW-UPS OVERDUE"
          value={summary.dueTasks.length}
          sub="Requires your attention"
          icon="bell"
          accent="rose"
        />
        <Metric
          name="CLIENT CARE DUE"
          value={summary.clientCare.length}
          sub="Relationship touchpoints"
          icon="heart"
          accent="sky"
        />
      </div>
      <div className="two-grid">
        <section className="panel">
          <TitleSection
            heading="Lead quality distribution"
            caption="Automatic tiers based on qualification criteria"
          />
          <div className="tier-list">
            {counts.map((c, i) => (
              <div key={c.title} className="tier-item">
                <div
                  className="tier-icon"
                  style={{ background: COLORS[i] + '24', color: COLORS[i] }}
                >
                  <Icon name={i === 0 ? 'sparkle' : i === 4 ? 'close' : 'users'} size={17} />
                </div>
                <span>{c.title}</span>
                <div className="tier-track">
                  <div style={{ background: COLORS[i], width: (c.value / total) * 100 + '%' }} />
                </div>
                <strong>{c.value}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <TitleSection
            heading="Active pipelines"
            caption="Opportunity mix across all real estate specializations"
          />
          <div className="pipeline-list">
            {pipelineTypes.map((x, i) => (
              <div className="bar-row" key={x.name}>
                <div className="bar-label">
                  <span>{x.name}</span>
                  <strong>{x.value}</strong>
                </div>
                <div className="bar-track">
                  <div
                    style={{
                      width: (x.value / Math.max(1, data.Deals.length)) * 100 + '%',
                      background: COLORS[i % COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="two-grid">
        <section className="panel">
          <TitleSection
            heading="Lost lead intelligence"
            caption="Learn why opportunities did not convert"
          />
          {lostReasons.length ? (
            lostReasons.map((r, i) => (
              <div className="lost-reason" key={r.name}>
                <span>{r.name}</span>
                <Badge tone="amber">{r.value} records</Badge>
              </div>
            ))
          ) : (
            <Empty
              title="No lost reasons yet"
              detail="Record a reason whenever a deal doesn't progress."
              icon="target"
            />
          )}
        </section>
        <section className="panel">
          <TitleSection
            heading="Needs qualification"
            caption="New contacts with incomplete buyer profiles"
          />
          {data.Clients.filter((c) => !get(c, 'Funds confirmed') || !get(c, 'Decision maker'))
            .slice(0, 4)
            .map((c) => (
              <button
                key={get(c, 'Client ID')}
                className="client-mini"
                onClick={() => dispatchRow('Clients', c)}
              >
                <span className="avatar">{initials(get(c, 'Full name'))}</span>
                <div>
                  <strong>{get(c, 'Full name')}</strong>
                  <small>{get(c, 'Preferred communities') || 'Area not specified'}</small>
                </div>
                <Badge>{leadTier(c)}</Badge>
              </button>
            ))}
          {data.Clients.length === 0 && (
            <Empty detail="Lead quality insights appear when you add clients." />
          )}
        </section>
      </div>
    </div>
  );
}

export { InsightsPage };
