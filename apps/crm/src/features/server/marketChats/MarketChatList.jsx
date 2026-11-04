import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { GridFilterBar } from '../../records/grid/GridFilterBar.jsx';
import '../../records/grid/grid-filter.css';
import { requestTitle } from '../marketplace/requestText.js';

/** The rows a view and search leave: Active or Closed, by broker or request. */
export function chatView(rows, view, t) {
  const needle = view.query.trim().toLowerCase();
  return rows.filter(
    (row) =>
      row.closed === view.closed &&
      (!needle ||
        `${row.participantName} ${requestTitle(t, row.request)}`.toLowerCase().includes(needle)),
  );
}

/** The chats list: the mockup's Active and Closed with search, newest first. */
export function MarketChatList({
  rows,
  view,
  onView,
  selectedId,
  onOpen,
  nextOffset,
  loadingMore,
  onMore,
}) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`marketChats.${key}`, vars);
  const tabs = [k('active'), k('closed')];
  const shown = chatView(rows, view, t);
  return (
    <section className="market-chat-list" aria-label={k('listLabel')}>
      <GridFilterBar
        module={k('module')}
        presetLabel={tabs[Number(view.closed)]}
        tabs={tabs}
        tab={tabs[Number(view.closed)]}
        onTab={(name) => onView({ ...view, closed: name === tabs[1] })}
        query={view.query}
        onQuery={(query) => onView({ ...view, query })}
      />
      {!shown.length && <p className="market-chat-empty">{k('noneHere')}</p>}
      <ul>
        {shown.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              className={'market-chat-row' + (row.id === selectedId ? ' is-open' : '')}
              aria-current={row.id === selectedId ? 'true' : undefined}
              onClick={() => onOpen(row.id)}
            >
              <span className="market-chat-top">
                <strong>{row.participantName}</strong>
                <time dateTime={row.updatedAt}>{format.date(row.updatedAt)}</time>
              </span>
              <span className="market-chat-about">
                {k(row.mine ? 'yourRequest' : 'theirRequest', {
                  request: requestTitle(t, row.request),
                })}
              </span>
              {row.lastMessage && <span className="market-chat-last">{row.lastMessage.body}</span>}
            </button>
          </li>
        ))}
      </ul>
      {nextOffset != null && (
        <div className="market-chat-more">
          {view.query && <p>{k('searchLoaded')}</p>}
          <Button variant="light" disabled={loadingMore} onClick={onMore}>
            {loadingMore ? k('loadingMore') : k('loadMore')}
          </Button>
        </div>
      )}
    </section>
  );
}
