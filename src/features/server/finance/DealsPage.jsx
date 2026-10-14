import React, { useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { N } from '../../../lib/format.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { emptyDealFilters, filterDeals } from './dealFilters.js';
import { DealFilters } from './DealFilters.jsx';
import { DealTable } from './DealTable.jsx';
import { DealDialogs } from './DealDialogs.jsx';
import { HandoverRequests } from './HandoverRequests.jsx';
import { CommissionStatement } from './CommissionStatement.jsx';

const tabs = [
  { id: 'deals', label: 'Deals' },
  { id: 'statement', label: 'Commission statement' },
];

/**
 * "Deals & commissions" (finance-design §7): the caller's shaped deals with filters, pending
 * hand-over requests and the commission statement. Every action follows `financeAccess`
 * and the row's server-computed `allowed`.
 */
export function DealsPage() {
  const { overview, team, actions, readOnly } = useFinanceContext();
  const [tab, setTab] = useState('deals');
  const [filters, setFilters] = useState(emptyDealFilters);
  const [page, setPage] = useState(0);
  const [dialog, setDialog] = useState(null);
  const deals = overview.deals;
  const visible = useMemo(
    () => filterDeals(deals, filters, overview.references),
    [deals, filters, overview.references],
  );
  const changeFilters = (next) => {
    setFilters(next);
    setPage(0);
  };
  const open = (kind, deal = null, extra = {}) => setDialog({ kind, dealId: deal?.id, ...extra });
  return (
    <div className="page-stack finance-page">
      <div className="directory-top">
        <div className="directory-count">
          <div className="large-count">{N(deals.length)}</div>
          <div>
            <strong>{team ? 'Team deals' : 'Your deals'}</strong>
            <p>
              {team
                ? 'Every deal in this workspace, with the full commission split.'
                : 'Deals you hold and your own commission.'}
            </p>
          </div>
        </div>
        {actions.can('createDeal') && (
          <Button icon="plus" onClick={() => open('create')}>
            Add deal
          </Button>
        )}
      </div>
      {readOnly && (
        <p className="finance-note" role="note">
          This workspace is archived. Deals are read-only.
        </p>
      )}
      <HandoverRequests onApprove={(handover) => open('approveHandover', null, { handover })} />
      <div className="tabs finance-tabs" role="group" aria-label="Deals views">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            className={tab === item.id ? 'active' : ''}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'deals' ? (
        <>
          <DealFilters filters={filters} onChange={changeFilters} count={visible.length} />
          <DealTable
            deals={visible}
            total={deals.length}
            page={page}
            onPage={setPage}
            onOpen={(deal) => open('details', deal)}
            onAdd={actions.can('createDeal') ? () => open('create') : null}
            onReset={() => changeFilters(emptyDealFilters)}
          />
        </>
      ) : (
        <CommissionStatement />
      )}
      <DealDialogs dialog={dialog} close={() => setDialog(null)} />
    </div>
  );
}
