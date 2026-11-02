import React, { useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Empty } from '../../../components/ui/Empty.jsx';
import { useRememberedChoice } from '../../../hooks/useRememberedChoice.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { dubaiToday } from '../../../lib/dubaiDate.js';
import { GridColumnChooser } from '../../records/grid/GridColumnChooser.jsx';
import { useFinanceContext } from './useFinanceRequests.js';
import { emptyDealFilters, filterDeals } from './dealFilters.js';
import { dealListColumns } from './DealListColumns.jsx';
import { DealsToolbar } from './DealsToolbar.jsx';
import { DealTable } from './DealTable.jsx';
import { DealDialogs } from './DealDialogs.jsx';
import { HandoverRequests } from './HandoverRequests.jsx';
import { CommissionStatement } from './CommissionStatement.jsx';
import { DealsBoard } from './DealsBoard.jsx';
import { useEntryColumns } from './useEntryColumns.js';

const dealViews = ['kanban', 'list'];
const tabs = [
  { id: 'deals', label: 'Deals' },
  { id: 'statement', label: 'Commission statement' },
];

/**
 * "Deals & commissions" (finance-design §7) as the approved mockup's screen (design queue item
 * 5): Deals / Commission statement, the scope and Add deal, pending hand-over requests, then
 * the filter row (All deals, Closing this month, our kept filters) above the Kanban or List.
 * Every action follows `financeAccess` and the row's server-computed `allowed`.
 */
export function DealsPage() {
  const { overview, team, actions, readOnly, user } = useFinanceContext();
  const { t } = useI18n();
  const [view, setView] = useRememberedChoice(`kws-deals-view:${user.id}`, dealViews, 'kanban');
  const [tab, setTab] = useState('deals');
  const [filters, setFilters] = useState(emptyDealFilters);
  const [page, setPage] = useState(0);
  const [dialog, setDialog] = useState(null);
  const deals = overview.deals;
  const today = dubaiToday();
  const visible = useMemo(
    () => filterDeals(deals, filters, overview.references, today),
    [deals, filters, overview.references, today],
  );
  const listColumns = useMemo(
    () => dealListColumns({ team, me: user.id, references: overview.references, t }),
    [team, user.id, overview.references, t],
  );
  const columns = useEntryColumns('deals', user.id, listColumns);
  const changeFilters = (next) => {
    setFilters(next);
    setPage(0);
  };
  const open = (kind, deal = null, extra = {}) => setDialog({ kind, dealId: deal?.id, ...extra });
  const add = actions.can('createDeal') ? () => open('create') : null;
  const reset = () => changeFilters(emptyDealFilters);
  const empty = deals.length ? (
    <Empty
      icon="search"
      title={t('dealsBoard.noMatch')}
      detail={t('dealsBoard.noMatchDetail')}
      action={<Button onClick={reset}>{t('dealsBoard.clear')}</Button>}
    />
  ) : (
    <Empty
      icon="briefcase"
      title={t('dealsBoard.none')}
      detail={team ? t('dealsBoard.noneDetail') : 'Deals you hold appear here.'}
      action={add && <Button onClick={add}>Add deal</Button>}
    />
  );
  return (
    <div className="page-stack finance-page deals-page">
      <div className="entries-head deals-head">
        <div className="tabs finance-tabs" role="group" aria-label={t('dealsBoard.sections')}>
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
        <p className="entries-scope">{t(team ? 'dealsBoard.teamScope' : 'dealsBoard.ownScope')}</p>
        {add && (
          <Button icon="plus" onClick={add}>
            Add deal
          </Button>
        )}
      </div>
      {readOnly && (
        <p className="finance-note" role="note">
          This workspace is archived. Deals are read-only.
        </p>
      )}
      <HandoverRequests
        onApprove={(handover) => open('approveHandover', null, { handover })}
        onReview={(handover) => open('reviewHandover', null, { handover })}
      />
      {tab === 'deals' ? (
        <>
          <DealsToolbar
            filters={filters}
            onChange={changeFilters}
            view={view}
            onView={setView}
            chooser={<GridColumnChooser module="deals" grid={columns.grid} />}
          />
          {view === 'kanban' ? (
            <DealsBoard
              deals={visible}
              total={deals.length}
              stage={filters.stage}
              onOpen={(deal) => open('details', deal)}
              onAdd={add}
              onReset={reset}
            />
          ) : (
            <DealTable
              deals={visible}
              page={page}
              onPage={setPage}
              onOpen={(deal) => open('details', deal)}
              shown={columns.shown}
              empty={empty}
            />
          )}
        </>
      ) : (
        <CommissionStatement />
      )}
      <DealDialogs dialog={dialog} close={() => setDialog(null)} />
    </div>
  );
}
