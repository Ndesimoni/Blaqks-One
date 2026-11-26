import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Empty } from '../../../components/ui/Empty.jsx';
import { useMediaQuery } from '../../../hooks/useMediaQuery.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { presetTotal } from './clientsModel.js';
import { ClientCards } from './ClientCards.jsx';
import { ClientsTable } from './ClientsTable.jsx';
import '../../records/grid/grid-card.css';
import '../../records/grid/grid-foot.css';

/** Below the CRM grid's breakpoint one card per client replaces the table. */
const cardQuery = '(max-width: 750px)';

/**
 * The clients in one bordered grid card, as the CRM's lists: the table (cards on phones),
 * an empty filter state, then the footer with the total and Load more for the next page.
 * While a new view loads, the rows already shown stay, marked busy.
 */
export function ClientsGrid({ list, stage, onOpen }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`platformClients.${key}`, vars);
  const cards = useMediaQuery(cardQuery);
  const total = presetTotal(list.counts, stage);
  const rows = list.rows;
  return (
    <div
      className={'grid-card platform-clients-grid' + (list.loading ? ' is-loading' : '')}
      aria-busy={list.loading || list.searching}
    >
      {rows.length > 0 &&
        (cards ? (
          <ClientCards rows={rows} onOpen={onOpen} />
        ) : (
          <ClientsTable rows={rows} onOpen={onOpen} />
        ))}
      {!rows.length && <Empty title={k('noMatch')} detail={k('noMatchHint')} />}
      <div className="grid-foot">
        <p className="grid-total">
          {total === null ? (
            k('shown', { shown: rows.length })
          ) : (
            <>
              {k('total')} <strong>{total}</strong>
            </>
          )}
        </p>
        {list.loading && (
          <span className="platform-clients-updating" role="status">
            {k('updating')}
          </span>
        )}
        {list.next && (
          <Button
            variant="light"
            onClick={list.loadMore}
            disabled={list.more}
            aria-busy={list.more}
          >
            {list.more ? k('loadingMore') : k('loadMore')}
          </Button>
        )}
      </div>
      {list.moreError && (
        <p className="field-error platform-clients-more-error" role="alert">
          {list.moreError}
        </p>
      )}
    </div>
  );
}
