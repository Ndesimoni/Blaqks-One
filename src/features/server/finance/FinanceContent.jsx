import React, { useMemo } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { Button } from '../../../components/ui/Button.jsx';
import { ServerUnavailableSection } from '../ServerUnavailableSection.jsx';
import { useFinance } from './useFinance.js';
import { useFinanceActions } from './useFinanceActions.js';
import { FinanceContext, useFinanceAssignees } from './useFinanceRequests.js';
import { DealsPage } from './DealsPage.jsx';
import './finance.css';
import './finance-dialogs.css';
import './finance-forms.css';

/** Finance sections that are connected; Payments and Expenses follow in packet F3. */
export const connectedFinanceRoutes = ['Deals'];

/**
 * Connected finance (finance-design §7). The overview comes only from `GET /finance` for the
 * selected workspace, shaped by the server for team or own view; nothing is kept in browser
 * storage and a server failure never falls back to demo data.
 */
export function FinanceContent({ route, owner }) {
  const { api, user } = useSession();
  const readOnly = owner.status === 'archived';
  const finance = useFinance(api, owner.id, user);
  const actions = useFinanceActions({ api, workspaceId: owner.id, user, finance, readOnly });
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
  if (!connectedFinanceRoutes.includes(route))
    return <ServerUnavailableSection route={route} owner={owner} />;
  if (finance.loading && !finance.overview)
    return (
      <p className="finance-status" role="status">
        Loading deals…
      </p>
    );
  if (finance.error || !finance.overview)
    return (
      <section className="panel recovery-panel" aria-label="Deals unavailable">
        <h2>Deals could not be loaded</h2>
        <p className="field-error" role="alert">
          {finance.error || 'The CRM server returned no finance information.'}
        </p>
        {finance.access.scope !== 'none' && <Button onClick={finance.retry}>Retry</Button>}
      </section>
    );
  return (
    <FinanceContext.Provider value={value}>
      <DealsPage />
    </FinanceContext.Provider>
  );
}
