import React from 'react';
import { ColumnSparkline } from '../../../components/charts/ColumnSparkline.jsx';
import { StageBar } from '../../../components/charts/StageBar.jsx';
import { TargetBar } from '../../../components/charts/TargetBar.jsx';
import { formatAed } from '../../../lib/finance/money.js';
import { N } from '../../../lib/format.js';
import { get } from '../../../lib/records.js';
import { dayOf } from '../../../lib/dubaiDate.js';
import * as model from './keyFiguresModel.js';

const plural = (count, word) => `${N(count)} ${word}${count === 1 ? '' : 's'}`;
const monthLabel = (month) =>
  new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-AE', {
    month: 'short',
    timeZone: 'UTC',
  });

/** Record figures: leads, follow-ups, viewings and listings the member may open. */
export function recordFigures({ figures, widgets, data, today }) {
  const weekly = model.weeklyCounts(
    data.Clients.map((row) => dayOf(get(row, 'Date added'))),
    today,
  );
  const split = model.followUpSplit(figures.dueTasks, today);
  const days = figures.upcoming.map((row) => dayOf(get(row, 'Appointment date & time')));
  return [
    widgets.leads && {
      key: 'leads',
      label: 'Active leads',
      value: N(figures.openLeads.length),
      sub: plural(figures.hot.length, 'high-priority lead'),
      chart: weekly.some(Boolean) && (
        <ColumnSparkline
          values={weekly}
          label="New leads per week, last 8 weeks"
          describe={(value) => String(value)}
        />
      ),
      note: weekly.some(Boolean) ? 'weekly new leads' : '',
    },
    widgets.schedule && {
      key: 'due',
      label: 'Follow-ups due',
      value: N(figures.dueTasks.length),
      sub: 'Today & overdue',
      chart: figures.dueTasks.length > 0 && (
        <StageBar
          label="Follow-ups due"
          segments={[
            { name: 'Overdue', value: split.overdue, tone: 'amber' },
            { name: 'Today', value: split.today, tone: 'accent' },
          ]}
        />
      ),
    },
    widgets.schedule && {
      key: 'viewings',
      label: 'Upcoming viewings',
      value: N(figures.upcoming.length),
      sub: 'From today onwards',
      chart: figures.upcoming.length > 0 && (
        <ColumnSparkline
          values={model.dailyCounts(days, today)}
          highlight={0}
          label="Viewings per day for the next 7 days, starting today"
        />
      ),
      note: figures.upcoming.length > 0 ? 'next 7 days' : '',
    },
    widgets.properties && {
      key: 'properties',
      label: 'Properties',
      value: N(figures.properties),
      sub: `${N(figures.available)} available`,
      chart: figures.properties > 0 && (
        <StageBar label="Listings by status" segments={model.propertyStatus(data.Properties)} />
      ),
    },
  ].filter(Boolean);
}

/** Finance figures from the scoped overview: open deals and this month's fees. */
export function financeFigures({ finance, targets, month, me }) {
  const overview = finance.overview;
  const team = (overview?.scope || finance.access.scope) === 'team';
  const state = overview ? 'ready' : finance.loading ? 'loading' : 'error';
  const deals = overview ? model.openDeals(overview.deals) : null;
  const fees = overview ? model.feesInMonth(overview, month) : 0;
  const target = overview ? model.feesTarget(targets, overview.scope, me) : null;
  const percent = target ? Math.round((fees / target) * 100) : null;
  const failed = 'Finance could not be loaded';
  return [
    {
      key: 'deals',
      label: 'Open deals',
      state,
      value: deals ? N(deals.count) : '—',
      sub: deals ? (team ? 'Across the team' : 'Deals you hold') : failed,
      chart: deals?.count > 0 && <StageBar label="Open deals by stage" segments={deals.segments} />,
    },
    {
      key: 'fees',
      label: `${team ? 'Fees earned' : 'Your commission'} · ${monthLabel(month)}`,
      state,
      value: overview ? model.shortAed(fees) : '—',
      full: overview ? formatAed(fees) : '',
      chip: percent !== null && {
        text: `${percent}% of target`,
        tone: percent >= 70 ? 'accent' : 'amber',
      },
      sub: overview ? (team ? 'Gross fees on earned deals' : 'On your earned deals') : failed,
      chart: target && (
        <TargetBar value={fees} target={target} label={`Monthly target ${formatAed(target)}`} />
      ),
      note: overview && !target ? 'no monthly target' : '',
    },
  ];
}
