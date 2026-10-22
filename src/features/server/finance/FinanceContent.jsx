import React, { useCallback, useMemo } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useRecords } from '../../../hooks/useWorkspace.js';
import { Button } from '../../../components/ui/Button.jsx';
import { ServerUnavailableSection } from '../ServerUnavailableSection.jsx';
import { useFinance } from './useFinance.js';
import { useFinanceActions } from './useFinanceActions.js';
import { FinanceContext, useFinanceAssignees } from './useFinanceRequests.js';
import { DealsPage } from './DealsPage.jsx';
import { PaymentsPage } from './PaymentsPage.jsx';
import { ExpensesPage } from './ExpensesPage.jsx';
import { FinanceSkeleton } from './FinanceSkeleton.jsx';
import './finance.css';
import './finance-dialogs.css';
import './finance-forms.css';
import './finance-entries.css';
import './finance-entry-table.css';
import './finance-details.css';
import './finance-decisions.css';
import './finance-skeleton.css';
import './deal-list.css';
import './deal-details.css';
import './deal-dialogs.css';

/** Connected finance sections and their pages (finance-design §7). */
const pages = { Deals: DealsPage, Payments: PaymentsPage, Expenses: ExpensesPage };
const nouns = { Deals: 'deals', Payments: 'payments', Expenses: 'expenses' };
export const connectedFinanceRoutes = Object.keys(pages);

/**
 * Connected finance (finance-design §7). The overview comes only from `GET /finance` for the
 * selected workspace, shaped by the server for team or own view; nothing is kept in browser
 * storage and a server failure never falls back to demo data.
 */
export function FinanceContent({ route, owner }) {
  const { api, user } = useSession();
  const readOnly = owner.status === 'archived';
  const finance = useFinance(api, owner.id, user);
  const records = useRecords();
  // The client and listing move with an accepted deal (agreements design §18).
  const reloadRecords = records?.refresh;
  const afterMove = useCallback(() => reloadRecords?.().catch(() => {}), [reloadRecords]);
  const options = { api, workspaceId: owner.id, user, finance, readOnly, afterMove };
  const actions = useFinanceActions(options);
  const assignees = useFinanceAssignees(api, owner.id, finance.access);
  const value = useMemo(
    () => ({
      api,
      user,
      owner,
      workspaceId: owner.id,
      readOnly,
      access: finance.access,
      team: finance.access.scope === 'team',
      overview: finance.overview,
      refresh: finance.refresh,
      actions,
      assignees,
    }),
    [api, user, owner, readOnly, finance, actions, assignees],
  );
  const Page = pages[route];
  if (!Page) return <ServerUnavailableSection route={route} owner={owner} />;
  const noun = nouns[route];
  if (finance.loading && !finance.overview) return <FinanceSkeleton noun={noun} />;
  if (finance.error || !finance.overview)
    return (
      <section className="panel recovery-panel" aria-label={`${route} unavailable`}>
        <h2>{route} could not be loaded</h2>
        <p className="field-error" role="alert">
          {finance.error || 'The CRM server returned no finance information.'}
        </p>
        {finance.access.scope !== 'none' && <Button onClick={finance.retry}>Retry</Button>}
      </section>
    );
  return (
    <FinanceContext.Provider value={value}>
      <Page />
    </FinanceContext.Provider>
  );
}
