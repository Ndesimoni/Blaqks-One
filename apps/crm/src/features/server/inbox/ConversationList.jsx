import React, { useId } from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { ConversationRow } from './ConversationRow.jsx';
import { CHANNELS, searchRows } from './inboxModel.js';
import { ListEmpty, ListError, ListSkeleton } from './InboxStates.jsx';

const STATES = ['', 'new', 'open', 'waiting', 'resolved'];

/** Arrow keys move between rows; Enter (the button's own action) opens one. */
function moveFocus(event) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const rows = [...event.currentTarget.querySelectorAll('.inbox-row')];
  const index = rows.indexOf(document.activeElement);
  const last = rows.length - 1;
  const next = {
    ArrowDown: Math.min(index + 1, last),
    ArrowUp: Math.max(index - 1, 0),
    Home: 0,
    End: last,
  }[event.key];
  if (rows[next]) {
    event.preventDefault();
    rows[next].focus();
  }
}

/** A channel's chip shows once the company has the channel, or while it is the filter. */
const shown = (name, filters, summary) =>
  name === filters.channel || (summary.channels ?? []).some((entry) => entry.channel === name);

/**
 * Search, then the channel chips and the state as one more chip (approved mockup), then the
 * bounded, scrolling list. New email is in the top bar's Create; the count is read out only.
 */
export function ConversationList({ view, list, summary, selectedId, onOpen }) {
  const { t } = useI18n();
  const id = useId();
  const { tab, filters, query } = view;
  const rows = searchRows(list.rows, query);
  return (
    <section className="inbox-list-pane" aria-label={t('inbox.list.label')}>
      <div className="inbox-list-tools">
        <div className="inbox-search-row">
          <label className="inbox-search">
            <Icon name="search" size={16} />
            <span className="sr-only">{t('inbox.list.search')}</span>
            <input
              type="search"
              value={query}
              placeholder={t('inbox.list.searchPlaceholder')}
              onChange={(event) => view.setQuery(event.target.value)}
            />
          </label>
        </div>
        <div className="inbox-filters">
          <div
            className="inbox-channel-chips"
            role="group"
            aria-label={t('inbox.list.channelFilter')}
          >
            {['', ...CHANNELS.filter((name) => shown(name, filters, summary))].map((name) => (
              <button
                key={name || 'all'}
                type="button"
                aria-pressed={filters.channel === name}
                onClick={() => view.setFilter('channel', name)}
              >
                {name ? t(`inbox.channel.${name}`) : t('inbox.list.all')}
              </button>
            ))}
          </div>
          {tab !== 'spam' && (
            <>
              <label htmlFor={`${id}-state`} className="sr-only">
                {t('inbox.list.stateFilter')}
              </label>
              <select
                id={`${id}-state`}
                className="inbox-state-chip"
                value={filters.state}
                onChange={(event) => view.setFilter('state', event.target.value)}
              >
                {STATES.map((name) => (
                  <option key={name || 'active'} value={name}>
                    {t(`inbox.state.${name || 'active'}`)}
                  </option>
                ))}
              </select>
            </>
          )}
          <span className="inbox-count sr-only" aria-live="polite">
            {list.status === 'ready' ? t('inbox.list.count', { count: rows.length }) : ''}
          </span>
        </div>
      </div>
      {list.status === 'loading' && <ListSkeleton />}
      {list.status === 'error' && <ListError onRetry={list.refresh} />}
      {list.status === 'ready' && !rows.length && (
        <ListEmpty
          searching={Boolean(query)}
          channels={summary.channels}
          ready={summary.ready}
          hasAny={summary.mine + summary.unassigned + summary.unread > 0}
        />
      )}
      {list.status === 'ready' && rows.length > 0 && (
        <ul className="inbox-rows" onKeyDown={moveFocus}>
          {rows.map((row) => (
            <ConversationRow
              key={row.id}
              row={row}
              selected={row.id === selectedId}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}
      {list.next && !query && (
        <button type="button" className="inbox-more" disabled={list.more} onClick={list.loadMore}>
          {t('inbox.list.more')}
        </button>
      )}
    </section>
  );
}
