import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { Sparkbars } from '../dashboard/Sparkbars.jsx';
import { StatTile } from '../dashboard/StatTile.jsx';
import { compactMoney } from './metricsFormat.js';
import { websitesLive } from './metricsModel.js';

const tracked = (...values) => values.every((value) => value !== null);

/**
 * The dashboard's four figure tiles (the CRM Dashboard's stat tiles): companies active, monthly
 * active users, websites live and deals earned in the period with their platform-wide AED
 * value (its month-by-month trend is the Deals earned panel below, so the wide AED figure
 * stands alone). Untracked figures show a dash and say so; small trends have spoken summaries.
 */
export function MetricsTiles({ metrics }) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`platformMetrics.${key}`, vars);
  const { totals, inPeriod, trends } = metrics;
  const shown = (value) => (value === null ? '—' : format.number(value));
  const months = trends.months.map((month) => format.date(`${month}-01`, { month: 'short' }));
  const trend = (key) => {
    const values = trends[key];
    const said = values.map((value) => (value === null ? k('notTracked') : value));
    const summary = k('tile.trend', {
      series: t(`platformFigures.series.${key}`),
      values: said.slice(0, -1).join(', '),
      current: said.at(-1),
    });
    return <Sparkbars values={values} labels={months} summary={summary} />;
  };
  const { companies, activeUsers, websites } = totals;
  const sites = websitesLive(websites);
  const value = inPeriod.dealsEarnedValueFils;
  return (
    <section className="kpi-tiles" aria-label={k('figures')}>
      <StatTile
        label={k('tile.companies')}
        value={shown(companies.active)}
        note={
          tracked(companies.total, companies.archived)
            ? k('tile.companiesNote', { total: companies.total, archived: companies.archived })
            : k('notTracked')
        }
        route="Workspaces"
      >
        {trend('companiesNew')}
      </StatTile>
      <StatTile
        label={k('tile.users')}
        value={shown(activeUsers.last30Days)}
        note={
          tracked(activeUsers.today, activeUsers.last7Days)
            ? k('tile.usersNote', { today: activeUsers.today, week: activeUsers.last7Days })
            : k('notTracked')
        }
      >
        {trend('monthlyActiveUsers')}
      </StatTile>
      <StatTile
        label={k('tile.websites')}
        value={shown(sites)}
        note={
          tracked(websites.listingsLive)
            ? k('tile.websitesNote', { count: websites.listingsLive })
            : k('notTracked')
        }
      />
      <StatTile
        label={k('tile.deals', { period: k(`period.${metrics.period.key}`).toLowerCase() })}
        value={compactMoney(value) ?? '—'}
        note={
          tracked(inPeriod.dealsEarned, value)
            ? k('tile.dealsNote', { count: inPeriod.dealsEarned })
            : k('notTracked')
        }
      />
    </section>
  );
}
