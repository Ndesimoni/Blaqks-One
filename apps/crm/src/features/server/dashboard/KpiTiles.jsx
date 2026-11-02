import React from 'react';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { N } from '../../../lib/format.js';
import { addDays } from '../followUps/deadlineModel.js';
import {
  compactAed,
  followUpsDue,
  newLeadsByWeek,
  openPipeline,
  viewingsThisWeek,
  weekStart,
} from './kpiModel.js';
import { Sparkbars } from './Sparkbars.jsx';

const WEEKS = 8;
const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** One stat tile (label, value, note, optional trend); it opens the page behind the figure. */
function Tile({ label, value, note, tone = '', route, children }) {
  const { navigate } = useNavigation();
  return (
    <button type="button" className="kpi-tile" onClick={() => navigate(route)}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-row">
        <strong className="kpi-value">{value}</strong>
        {children}
      </span>
      {note && <span className={'kpi-note' + (tone ? ` is-${tone}` : '')}>{note}</span>}
    </button>
  );
}

/**
 * The approved mockup's four figure tiles over the workload's records: follow-ups due today
 * (and overdue), new leads this week against last week with an eight-week trend, viewings this
 * week by day, and the open deal pipeline (`deals`, null while loading; Active leads for
 * members without finance access).
 */
export function KpiTiles({ data, figures, deals, widgets, today }) {
  const { t, format } = useI18n();
  const due = followUpsDue(data['Follow-ups'], today);
  const weeks = newLeadsByWeek(data.Clients, today, WEEKS);
  const [last, now] = weeks.slice(-2);
  const change = now - last;
  const days = viewingsThisWeek(data.Viewings, today);
  const todayIndex = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const weekLabels = weeks.map((_, index) =>
    format.date(addDays(weekStart(today), -7 * (WEEKS - 1 - index)), {
      day: 'numeric',
      month: 'short',
    }),
  );
  const pipeline = deals ? openPipeline(deals) : null;
  const signed = `${change > 0 ? '+' : '−'}${Math.abs(change)}`;
  return (
    <section className="kpi-tiles" aria-label={t('dashboard.figures')}>
      {widgets.schedule && (
        <Tile
          label={t('dashboard.followUpsToday')}
          value={N(due.today)}
          note={
            due.overdue
              ? t('dashboard.overdue', { count: due.overdue })
              : t('dashboard.noneOverdue')
          }
          tone={due.overdue ? 'alert' : ''}
          route="Follow-ups"
        />
      )}
      {widgets.leads && (
        <Tile
          label={t('dashboard.newLeads')}
          value={N(now)}
          note={
            change ? t('dashboard.onLastWeek', { change: signed }) : t('dashboard.sameAsLastWeek')
          }
          tone={change > 0 ? 'up' : change < 0 ? 'down' : ''}
          route="Leads"
        >
          <Sparkbars
            values={weeks}
            labels={weekLabels}
            summary={t('dashboard.leadsTrend', {
              weeks: WEEKS,
              values: weeks.slice(0, -1).join(', '),
              current: now,
            })}
          />
        </Tile>
      )}
      {widgets.schedule && (
        <Tile
          label={t('dashboard.viewingsWeek')}
          value={N(days.reduce((sum, count) => sum + count, 0))}
          note={t('dashboard.viewingsToday', { count: days[todayIndex] })}
          route="Viewings"
        >
          <Sparkbars
            values={days}
            labels={dayNames}
            current={todayIndex}
            summary={t('dashboard.viewingsTrend', { values: days.join(', ') })}
          />
        </Tile>
      )}
      {widgets.finance ? (
        <Tile
          label={t('dashboard.openPipeline')}
          value={pipeline ? compactAed(pipeline.fils) : '—'}
          note={pipeline ? t('dashboard.openDeals', { count: pipeline.count }) : ''}
          route="Deals"
        />
      ) : (
        widgets.leads && (
          <Tile
            label={t('dashboard.activeLeads')}
            value={N(figures.openLeads.length)}
            note={t('dashboard.hotLeads', { count: figures.hot.length })}
            route="Leads"
          />
        )
      )}
    </section>
  );
}
