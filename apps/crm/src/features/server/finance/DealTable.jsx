import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { GridFoot } from '../../records/grid/GridFoot.jsx';
import '../../records/grid/grid-card.css';
import '../../records/grid/grid-open.css';
import { useFinanceContext } from './useFinanceRequests.js';
import { clampPage, DEALS_PER_PAGE, dealTitle, referenceName } from './dealFilters.js';
import { DealCards } from './DealCards.jsx';

/**
 * Paginated deals in the mockup's grid card (design queue item 5): a table at desktop and
 * cards at phone width, then the grid footer. The Deal cell names the deal (listing and type)
 * above its ID; `shown` are the chosen `[{ label, num?, cell(deal) }]` after it, money
 * right-aligned in tabular figures. Clicking a row opens the deal; `empty` replaces the rows.
 */
export function DealTable({ deals, page, onPage, onOpen, shown, empty }) {
  const { team, overview, user } = useFinanceContext();
  const { t } = useI18n();
  const current = clampPage(page, deals.length);
  const rows = deals.slice(current * DEALS_PER_PAGE, (current + 1) * DEALS_PER_PAGE);
  const client = (deal) =>
    referenceName(overview.references, 'Clients', deal.clientId) ?? deal.clientId;
  const title = (deal) => dealTitle(deal, overview.references);
  return (
    <div className="grid-card finance-table-shell">
      {rows.length ? (
        <>
          <div className="table-scroll deal-table-scroll">
            <table className="data-table grid-table deal-table" aria-label="Deals">
              <thead>
                <tr>
                  <th scope="col">{t('dealsBoard.colDeal')}</th>
                  {shown.map((column) => (
                    <th key={column.label} scope="col" className={column.num ? 'finance-num' : ''}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((deal) => (
                  <tr
                    key={deal.id}
                    data-earned={deal.earnedOn ? 'true' : 'false'}
                    onClick={() => onOpen(deal)}
                  >
                    <td className="deal-name-cell">
                      {/* Its click reaches the row, which opens the deal. */}
                      <button
                        type="button"
                        className="grid-open"
                        aria-label={`Open deal ${deal.dealId}`}
                      >
                        <span className="cell-strong">{title(deal)}</span>
                      </button>
                      <small className="finance-sub mono">{deal.dealId}</small>
                    </td>
                    {shown.map((column) => (
                      <td key={column.label} className={column.num ? 'finance-num' : ''}>
                        {column.cell(deal)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DealCards
            rows={rows}
            team={team}
            me={user.id}
            title={title}
            client={client}
            shareLabel={t(team ? 'dealsBoard.companyShare' : 'dealsBoard.yourCommission')}
            onOpen={onOpen}
          />
        </>
      ) : (
        empty
      )}
      <GridFoot
        total={deals.length}
        page={current}
        perPage={DEALS_PER_PAGE}
        label="Deals pages"
        onPage={onPage}
      />
    </div>
  );
}
