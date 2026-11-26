import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { N } from '../../../lib/format.js';
import { compactAed } from '../dashboard/kpiModel.js';
import { Sparkbars } from '../dashboard/Sparkbars.jsx';
import { StatTile } from '../dashboard/StatTile.jsx';
import { dubaiMonth } from '../../../lib/dubaiDate.js';
import { longMonth, shortMonth } from './chartModel.js';
import { daysToClose, leadResponse } from './performanceKpis.js';

/** "+2 on last month", or the same-month text, with the tile's tone. */
function change(t, now, before) {
  const diff = now - before;
  if (!diff) return { note: t('performance.sameAsLastMonth'), tone: '' };
  const signed = `${diff > 0 ? '+' : '−'}${Math.abs(diff)}`;
  return { note: t('performance.onLastMonth', { change: signed }), tone: diff > 0 ? 'up' : 'down' };
}

/**
 * The approved mockup's Performance tiles for the selected month: deals won (against last
 * month, with a twelve-month trend), commission earned, average days to close and lead
 * response time. Deal and money tiles need `financeReady`; without it the member sees lead
 * response and new enquiries, so no deal or fee figure ever appears (finance-design §7).
 */
export function PerformanceKpis({ rows, closed, financeReady, selection, me, data, month }) {
  const { t } = useI18n();
  const [before, now] = rows.slice(-2);
  const labels = rows.map((row) => shortMonth(row.month));
  const trend = (key, summaryKey, format = (value) => value) => (
    <Sparkbars
      values={rows.map((row) => row[key])}
      labels={labels}
      summary={t(summaryKey, { values: rows.map((row) => format(row[key])).join(', ') })}
    />
  );
  const response = leadResponse(data, month);
  const responseValue =
    response.days === null
      ? '—'
      : response.days < 1
        ? t('performance.sameDay')
        : t('performance.days', { days: response.days.toFixed(1) });
  const closing = financeReady ? daysToClose(closed) : null;
  // "This month" only for the current month; an earlier one is named.
  const named = (key) =>
    month === dubaiMonth()
      ? t(`performance.${key}`)
      : t(`performance.${key}In`, { month: longMonth(month) });
  return (
    <section className="kpi-tiles" aria-label={t('performance.figures')}>
      {financeReady ? (
        <>
          <StatTile
            label={named('dealsWon')}
            value={N(now.deals)}
            {...change(t, now.deals, before.deals)}
          >
            {trend('deals', 'performance.dealsTrend')}
          </StatTile>
          <StatTile
            label={t('performance.commission')}
            value={compactAed(now.fees)}
            note={t(
              selection.kind === 'team'
                ? 'performance.commissionTeam'
                : selection.memberId === me
                  ? 'performance.commissionOwn'
                  : 'performance.commissionMember',
            )}
          >
            {trend('fees', 'performance.feesTrend', (fils) => Math.round(fils / 100))}
          </StatTile>
          <StatTile
            label={t('performance.daysToClose')}
            value={closing.days === null ? '—' : N(closing.days)}
            note={
              closing.measured
                ? t('performance.closedMeasured', { count: closing.measured })
                : t('performance.noCloseDates')
            }
          />
        </>
      ) : (
        <StatTile
          label={named('enquiries')}
          value={N(now.enquiries)}
          {...change(t, now.enquiries, before.enquiries)}
        >
          {trend('enquiries', 'performance.enquiriesTrend')}
        </StatTile>
      )}
      <StatTile
        label={t('performance.responseTime')}
        value={responseValue}
        note={
          response.measured
            ? t('performance.responseMeasured', { count: response.measured })
            : t('performance.noResponse')
        }
      />
    </section>
  );
}
