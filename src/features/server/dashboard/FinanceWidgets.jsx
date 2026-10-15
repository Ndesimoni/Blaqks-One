import React, { useMemo } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { Button } from '../../../components/ui/Button.jsx';
import { TitleSection } from '../../../components/ui/TitleSection.jsx';
import { N } from '../../../lib/format.js';
import { useFinance } from '../finance/useFinance.js';
import { QUEUE_QUERY } from '../finance/entryFilters.js';
import { financeFigures } from './financeDashboard.js';
import './finance-widgets.css';

/** Approvers jump to each list's queue; everyone else opens the lists. */
function PendingRow({ pending, approver, navigate }) {
  const query = approver ? QUEUE_QUERY : '';
  return (
    <div className="finance-widget-pending">
      <div>
        <strong className="finance-widget-count">{N(pending.count)}</strong>
        <span>{pending.label}</span>
      </div>
      <div className="finance-widget-links">
        <Button variant="light" onClick={() => navigate('Payments', query)}>
          {approver ? 'Review payments' : 'Open payments'}
        </Button>
        <Button variant="light" onClick={() => navigate('Expenses', query)}>
          {approver ? 'Review expenses' : 'Open expenses'}
        </Button>
      </div>
    </div>
  );
}

/**
 * Dashboard finance (finance-design §7), fed only from `GET /finance` for the selected
 * workspace. The own view shows the member's commission and submissions — never company
 * figures; the team view shows the team totals. A failure stays inside this panel.
 */
export function FinanceWidgets({ owner }) {
  const { api, user } = useSession();
  const { navigate } = useNavigation();
  const finance = useFinance(api, owner.id, user);
  const figures = useMemo(
    () => (finance.overview ? financeFigures(finance.overview, user.id) : null),
    [finance.overview, user.id],
  );
  const team = figures?.scope === 'team';
  return (
    <section className="panel finance-widgets" aria-label="Finance at a glance">
      <TitleSection
        heading={team ? 'Team finance' : 'Your finance'}
        caption={
          team
            ? 'Totals for this workspace. Only approved payments and expenses count.'
            : 'Your own commission. Only approved payments count as received.'
        }
        action={
          <Button variant="light" onClick={() => navigate('Deals')}>
            Open deals
          </Button>
        }
      />
      {finance.loading && !figures && <p role="status">Loading finance…</p>}
      {finance.error && !figures && (
        <div className="finance-widget-error">
          <p className="field-error" role="alert">
            {finance.error}
          </p>
          <Button variant="light" onClick={finance.retry}>
            Retry
          </Button>
        </div>
      )}
      {figures && (
        <>
          <dl className="finance-widget-grid">
            {figures.tiles.map((item) => (
              <div key={item.id} className="finance-widget" data-figure={item.id}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
                <small>{item.note}</small>
              </div>
            ))}
          </dl>
          <PendingRow
            pending={figures.pending}
            approver={finance.access.approve}
            navigate={navigate}
          />
        </>
      )}
    </section>
  );
}
