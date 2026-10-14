import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Empty } from '../../../components/ui/Empty.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { readableDate } from '../../../lib/dates.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { paymentStatusLabels } from './financeLabels.js';
import { clampPage, DEALS_PER_PAGE, holderName, referenceName } from './dealFilters.js';
import { Money, rowFigures } from './DealMoney.jsx';
import { DealCards } from './DealCards.jsx';

/** Paginated deals: a table at desktop, cards at phone width (§7). */
export function DealTable({ deals, total, page, onPage, onOpen, onAdd, onReset }) {
  const { team, overview, user } = useFinanceContext();
  const current = clampPage(page, deals.length);
  const rows = deals.slice(current * DEALS_PER_PAGE, (current + 1) * DEALS_PER_PAGE);
  const client = (deal) =>
    referenceName(overview.references, 'Clients', deal.clientId) ?? deal.clientId;
  const shareLabel = team ? 'Company share' : 'Your commission';
  if (!deals.length)
    return total ? (
      <Empty
        icon="search"
        title="No matching deals"
        detail="Try another search or clear the filters."
        action={<Button onClick={onReset}>Clear filters</Button>}
      />
    ) : (
      <Empty
        icon="briefcase"
        title="No deals yet"
        detail={team ? 'Deals added in this workspace appear here.' : 'Deals you hold appear here.'}
        action={onAdd && <Button onClick={onAdd}>Add deal</Button>}
      />
    );
  return (
    <div className="table-shell finance-table-shell">
      <div className="table-scroll deal-table-scroll">
        <table className="data-table deal-table" aria-label="Deals">
          <thead>
            <tr>
              <th scope="col">Deal</th>
              <th scope="col">Client</th>
              <th scope="col">Stage</th>
              {team && <th scope="col">Holder</th>}
              <th scope="col" className="finance-num">
                Net fee
              </th>
              <th scope="col" className="finance-num">
                {shareLabel}
              </th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((deal) => {
              const figures = rowFigures(deal, team);
              return (
                <tr key={deal.id} onClick={() => onOpen(deal)}>
                  <td>
                    <button
                      type="button"
                      className="table-link mono id-link"
                      aria-label={`Open deal ${deal.dealId}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(deal);
                      }}
                    >
                      {deal.dealId}
                    </button>
                    <small className="finance-sub">{deal.dealType}</small>
                  </td>
                  <td className="cell-strong">{client(deal)}</td>
                  <td>
                    <Badge>{deal.stage}</Badge>
                  </td>
                  {team && <td>{holderName(deal.assignee, user.id)}</td>}
                  <td className="finance-num">
                    <Money value={figures.net} estimate={figures.estimate} />
                  </td>
                  <td className="finance-num">
                    <Money value={figures.share} estimate={figures.estimate} />
                  </td>
                  <td>
                    <Badge>{paymentStatusLabels[deal.paymentStatus]}</Badge>
                    {deal.earnedOn && (
                      <small className="finance-sub">Earned {readableDate(deal.earnedOn)}</small>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <DealCards
        rows={rows}
        team={team}
        me={user.id}
        client={client}
        shareLabel={shareLabel}
        onOpen={onOpen}
      />
      <Pagination
        variant="table"
        total={deals.length}
        page={current}
        pageSize={DEALS_PER_PAGE}
        itemLabel="deals"
        label="Deals pages"
        onChange={onPage}
      />
    </div>
  );
}
