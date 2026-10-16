import React, { useMemo } from 'react';
import { Ring } from '../../../components/charts/Ring.jsx';
import { formatAed } from '../../../lib/finance/money.js';
import { N } from '../../../lib/format.js';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { QUEUE_QUERY } from '../finance/entryFilters.js';
import { DashSection, SectionError, SectionLink, SectionLoading } from './DashSection.jsx';
import { financeFigures, financeRing } from './financeDashboard.js';
import { shortAed } from './keyFiguresModel.js';

/** Ledger rows that are also ring parts carry the part's swatch. */
const ringTones = { received: 'accent', outstanding: 'blue', expenses: 'amber' };

/** Approvers jump to each list's queue; everyone else opens the lists. */
function PendingRow({ pending, approver, navigate }) {
  const query = approver ? QUEUE_QUERY : '';
  return (
    <div className="finance-pending" data-pending={pending.count ? true : undefined}>
      <div className="finance-pending-text">
        {pending.count > 0 && <i className="finance-pending-dot" aria-hidden="true" />}
        <strong className="finance-pending-count">{N(pending.count)}</strong>
        <span>{pending.label}</span>
      </div>
      <div className="finance-pending-links">
        <SectionLink onClick={() => navigate('Payments', query)}>
          {approver ? 'Review payments' : 'Open payments'}
        </SectionLink>
        <SectionLink onClick={() => navigate('Expenses', query)}>
          {approver ? 'Review expenses' : 'Open expenses'}
        </SectionLink>
      </div>
    </div>
  );
}

/**
 * Finance at a glance (finance-design §7), from the workspace's scoped `GET /finance` only.
 * The own view shows the member's commission and submissions, never company figures; the
 * team view shows the server's team totals. A failure stays inside this section.
 */
export function FinanceSummary({ finance, me, className, style }) {
  const { navigate } = useNavigation();
  const { overview } = finance;
  const figures = useMemo(() => (overview ? financeFigures(overview, me) : null), [overview, me]);
  const ring = useMemo(() => (overview ? financeRing(overview) : null), [overview]);
  const team = (overview?.scope || finance.access.scope) === 'team';
  return (
    <DashSection
      className={className}
      style={style}
      regionLabel="Finance at a glance"
      label={team ? 'Team finance' : 'Your finance'}
      caption={
        team
          ? 'Totals for this workspace. Only approved payments and expenses count.'
          : 'Your own commission. Only approved payments count as received.'
      }
      action={<SectionLink onClick={() => navigate('Deals')}>Open deals</SectionLink>}
    >
      {!overview && finance.loading && <SectionLoading label="finance" />}
      {!overview && !finance.loading && (
        <SectionError message={finance.error} onRetry={finance.retry} />
      )}
      {figures && (
        <>
          <div className="finance-body">
            <Ring segments={ring.segments} label={ring.centre.label} format={formatAed}>
              <span className="finance-ring-label">{ring.centre.label}</span>
              <span className="finance-ring-value">
                {ring.centre.value < 0 ? '−' : ''}
                {shortAed(Math.abs(ring.centre.value))}
              </span>
            </Ring>
            <dl className="finance-ledger">
              {figures.tiles.map((item) => (
                <div key={item.id} className="finance-ledger-row" data-figure={item.id}>
                  <dt>
                    {ringTones[item.id] && (
                      <i className={`chart-swatch chart-tone-${ringTones[item.id]}`} />
                    )}
                    {item.label}
                    <small className="sr-only">{item.note}</small>
                  </dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <PendingRow
            pending={figures.pending}
            approver={finance.access.approve}
            navigate={navigate}
          />
        </>
      )}
    </DashSection>
  );
}
