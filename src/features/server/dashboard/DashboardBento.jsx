import React from 'react';
import { KeyFigureTile } from './KeyFigures.jsx';
import { financeFigures, recordFigures } from './keyFigureItems.jsx';
import { FeesSection } from './FeesSection.jsx';
import { FinanceSummary } from './FinanceSummary.jsx';
import { LeadSourcesSection, PipelineSection } from './LeadSections.jsx';
import { TeamSection } from './TeamSection.jsx';
import { Agenda } from './Agenda.jsx';
import { RecordsInView } from './RecordsInView.jsx';
import { bentoLayout } from './bentoLayout.js';

/** Key figures in reading order: with finance, deals and fees sit beside the fees hero. */
function figureItems(dashboard, widgets, finance) {
  const { figures, data, today, month, targets, user } = dashboard;
  const records = recordFigures({ figures, widgets, data, today });
  if (!finance) return records;
  const money = financeFigures({ finance, targets, month, me: user.id });
  const [leads, ...rest] = records[0]?.key === 'leads' ? records : [null, ...records];
  return [leads, ...money, ...rest].filter(Boolean);
}

/**
 * The Dashboard bento: the fees hero (finance only) with key figures beside it, then the
 * finance summary, pipeline and sources, today, team and record totals. Placement comes from
 * `bentoLayout`.
 */
export function DashboardBento({ dashboard, widgets, finance }) {
  const { figures, data, month, targets, user, performance } = dashboard;
  const items = figureItems(dashboard, widgets, finance);
  const byKey = Object.fromEntries(items.map((item) => [item.key, item]));
  const teamFinance = finance?.access.scope === 'team';
  const render = {
    feesChart: (tile) => <FeesSection {...tile} finance={finance} month={month} />,
    finance: (tile) => <FinanceSummary {...tile} finance={finance} me={user.id} />,
    pipeline: (tile) => <PipelineSection {...tile} stages={figures.stages} />,
    sources: (tile) => <LeadSourcesSection {...tile} clients={data.Clients} />,
    team: (tile) => (
      <TeamSection
        {...tile}
        finance={finance}
        targets={targets}
        month={month}
        performance={performance}
      />
    ),
    today: (tile) => (
      <Agenda
        {...tile}
        summary={{ tasks: figures.tasks, dueTasks: figures.dueTasks }}
        viewings={dashboard.upcoming}
        allViewings={dashboard.allUpcoming}
        today={dashboard.today}
        clientName={dashboard.clientName}
        propertyName={dashboard.propertyName}
      />
    ),
    records: (tile) => (
      <RecordsInView {...tile} collections={widgets.collections} counts={figures.counts} />
    ),
  };
  const sections = [
    widgets.leads && { key: 'pipeline', span: 2 },
    widgets.leads && { key: 'sources', span: 2 },
    widgets.schedule && { key: 'today', span: 4 },
    teamFinance && { key: 'team', span: 2 },
    { key: 'records', span: 2 },
  ].filter(Boolean);
  const layout = bentoLayout({
    hero: finance ? 'feesChart' : null,
    second: finance ? 'finance' : null,
    figures: items.map((item) => ({ key: item.key, span: 1 })),
    sections,
  });
  return (
    <section className="bento" aria-label="Dashboard">
      {layout.map((tile, index) => {
        const props = {
          className: `bento-s${tile.span}${tile.rows > 1 ? ' bento-r2' : ''}`,
          style: { '--tile-index': Math.min(index, 6) },
        };
        if (byKey[tile.key])
          return <KeyFigureTile key={tile.key} item={byKey[tile.key]} {...props} />;
        return <React.Fragment key={tile.key}>{render[tile.key](props)}</React.Fragment>;
      })}
    </section>
  );
}
