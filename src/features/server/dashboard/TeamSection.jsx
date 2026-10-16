import React, { useMemo } from 'react';
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
import { teamRows } from './sectionsModel.js';

const initials = (name) =>
  String(name || '')
    .replace(/^Sample · /, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');

/** One ranked agent: initials, name, commission and deals, and % of target when one is set. */
function LeaderRow({ row, rank }) {
  const percent = row.targetFils ? Math.round((row.monthFils / row.targetFils) * 100) : null;
  return (
    <li className="leader">
      <span className="leader-rank">{rank}</span>
      <span className="leader-avatar" data-first={rank === 1 ? true : undefined} aria-hidden="true">
        {initials(row.name)}
      </span>
      <span className="leader-text">
        <strong>{row.name}</strong>
        <span>
          {formatAed(row.earnedFils)} earned · {N(row.deals)} {row.deals === 1 ? 'deal' : 'deals'}
        </span>
        <span>{formatAed(row.receivedFils)} received</span>
      </span>
      {percent !== null && (
        <span
          className={`v2-chip v2-chip-${percent >= 70 ? 'accent' : 'amber'}`}
          title={`${formatAed(row.monthFils)} this month against ${formatAed(row.targetFils)}`}
        >
          {percent}% of target
        </span>
      )}
    </li>
  );
}

/**
 * Team leaderboard (team finance view only): agents ranked by commission earned, with deals
 * and received share as the server totals them, and this month's % of their fees target when
 * the server returned a target to this caller.
 */
export function TeamSection({ finance, targets, month, performance, className, style }) {
  const { navigate } = useNavigation();
  const { overview } = finance;
  const rows = useMemo(() => teamRows(overview, targets, month), [overview, targets, month]);
  return (
    <DashSection
      className={className}
      style={style}
      label="Team · fees vs target"
      caption="Ranked by commission earned; targets are for this month"
      action={
        performance && (
          <SectionLink onClick={() => navigate('Performance')}>Open performance</SectionLink>
        )
      }
    >
      {!overview && finance.loading && <SectionLoading label="team" />}
      {!overview && !finance.loading && (
        <SectionError message={finance.error} onRetry={finance.retry} />
      )}
      {overview && !rows.length && <SectionEmpty>No agent commission recorded yet.</SectionEmpty>}
      {rows.length > 0 && (
        <ol className="leaderboard" aria-label="Agents ranked by commission earned">
          {rows.map((row, index) => (
            <LeaderRow key={row.id} row={row} rank={index + 1} />
          ))}
        </ol>
      )}
    </DashSection>
  );
}
