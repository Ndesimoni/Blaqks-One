import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { requestTitle } from '../marketplace/requestText.js';
import { initials } from '../profile/profileModel.js';

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

/**
 * The approved mockup's broker chat list (the Client inbox's rows): "Search broker chats", then
 * each chat's broker, when it last moved, the request and the latest message. Older chats load
 * in pages; search covers the chats loaded so far.
 */
export function MarketChatList({ rows, view, onQuery, selectedId, onOpen, more }) {
  const { t, format } = useI18n();
  const k = (key) => t(`marketChats.${key}`);
  const shown = chatView(rows, view, t);
  return (
    <section className="chat-list market-chat-list" aria-label={k('listLabel')}>
      <label className="chat-search">
        <span className="sr-only">{k('search')}</span>
        <input
          type="search"
          value={view.query}
          placeholder={k('search')}
          onChange={(event) => onQuery(event.target.value)}
        />
      </label>
      {!shown.length && <p className="chat-muted market-chat-none">{k('noneHere')}</p>}
      <ul>
        {shown.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              className={'inbox-row' + (row.id === selectedId ? ' is-selected' : '')}
              aria-current={row.id === selectedId ? 'true' : undefined}
              onClick={() => onOpen(row.id)}
            >
              <span className="inbox-avatar" aria-hidden="true">
                {initials(row.participantName)}
              </span>
              <span className="inbox-row-body">
                <span className="market-chat-request">{requestTitle(t, row.request)}</span>
                <span className="inbox-row-top">
                  <bdi className="inbox-row-name">{row.participantName}</bdi>
                  <time className="inbox-row-age" dateTime={row.updatedAt}>
                    {format.date(row.updatedAt, { dateStyle: 'medium' })}
                  </time>
                </span>
                <span className="inbox-row-preview">{row.lastMessage?.body || k('noText')}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {more.nextOffset != null && (
        <div className="market-chat-more">
          {view.query && <p className="chat-muted">{k('searchLoaded')}</p>}
          <Button variant="light" disabled={more.loading} onClick={more.load}>
            {more.loading ? k('loadingMore') : k('loadMore')}
          </Button>
        </div>
      )}
    </section>
  );
}
