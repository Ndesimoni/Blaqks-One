import React, { useMemo } from 'react';
import { ComparisonArea, ComparisonLegend } from '../../../components/charts/ComparisonArea.jsx';
import { formatAed } from '../../../lib/finance/money.js';
import { N } from '../../../lib/format.js';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import {
  DashSection,
  SectionEmpty,
  SectionError,
  SectionLink,
  SectionLoading,
} from './DashSection.jsx';
import { axisAed, shortAed } from './keyFiguresModel.js';
import { feesSeries } from './feesModel.js';
import './fees-section.css';

const names = { current: 'This year', previous: 'Last year' };

/** The 12-month total, its change against the 12 months before and the deals closed. */
function Headline({ series }) {
  const { total, change, closed } = series;
  const chip =
    change === null ? 'v2-chip' : change >= 0 ? 'v2-chip v2-chip-accent' : 'v2-chip v2-chip-amber';
  return (
    <div className="fees-headline">
      <div className="v2-figure v2-figure-hero">
        <span aria-hidden="true">{shortAed(total)}</span>
        <span className="sr-only">{formatAed(total)} over 12 months</span>
      </div>
      <p className="fees-delta">
        <span className={chip}>
          {change === null
            ? 'No earlier figures'
            : `${change >= 0 ? '↑' : '↓'} ${Math.abs(change)}%`}
        </span>
        {change !== null && <span>vs previous 12 months</span>}
        <span>
          · {N(closed)} {closed === 1 ? 'deal' : 'deals'} closed
        </span>
      </p>
    </div>
  );
}

/** The on-chart note for the latest month: month, amount and deals closed. */
function LatestMonth({ latest }) {
  return (
    <>
      <span>{latest.name}</span>
      <b>{formatAed(latest.current)}</b>
      <span>
        {N(latest.closed)} {latest.closed === 1 ? 'deal' : 'deals'} closed
      </span>
    </>
  );
}

/** The same figures as a table for assistive technology. */
function SeriesTable({ series, caption }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Month</th>
          <th scope="col">{names.current}</th>
          <th scope="col">{names.previous}</th>
        </tr>
      </thead>
      <tbody>
        {series.points.map((point) => (
          <tr key={point.month}>
            <th scope="row">{point.name}</th>
            <td>{formatAed(point.current)}</td>
            <td>{formatAed(point.previous)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Fees received over 12 months against the year before. Team view: approved payments by
 * receipt month (excluding VAT). Own view: the member's commission by earned month.
 */
export function FeesSection({ finance, month, className, style }) {
  const { navigate } = useNavigation();
  const { overview } = finance;
  const series = useMemo(() => (overview ? feesSeries(overview, month) : null), [overview, month]);
  const team = (overview?.scope || finance.access.scope) === 'team';
  const label = team ? 'Fees received · last 12 months' : 'Your commission · last 12 months';
  return (
    <DashSection
      className={`fees-section ${className}`}
      style={style}
      label={label}
      caption={
        team
          ? 'Approved payments by receipt month, excluding VAT'
          : 'Your commission by the month each deal was earned'
      }
      action={
        <SectionLink onClick={() => navigate(team ? 'Payments' : 'Deals')}>
          {team ? 'Open payments' : 'Open deals'}
        </SectionLink>
      }
    >
      {!overview && finance.loading && <SectionLoading label={label} />}
      {!overview && !finance.loading && (
        <SectionError message={finance.error} onRetry={finance.retry} />
      )}
      {series?.empty && (
        <SectionEmpty>
          {team
            ? 'No approved payments in the last two years yet.'
            : 'No earned commission in the last two years yet.'}
        </SectionEmpty>
      )}
      {series && !series.empty && (
        <>
          <div className="fees-head">
            <Headline series={series} />
            <ComparisonLegend names={names} />
          </div>
          <ComparisonArea
            points={series.points}
            label={label}
            format={formatAed}
            axis={axisAed}
            names={names}
            legend={false}
            callout={<LatestMonth latest={series.latest} />}
          />
          <SeriesTable series={series} caption={label} />
        </>
      )}
    </DashSection>
  );
}
