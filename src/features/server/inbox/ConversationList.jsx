import React, { useId } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { ConversationRow } from './ConversationRow.jsx';
import { CHANNELS, TABS, searchRows } from './inboxModel.js';
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

/** Search, tabs, filters and the bounded, scrolling list of conversations. */
export function ConversationList({ view, list, summary, selectedId, onOpen, onStart }) {
  const { t } = useI18n();
  const id = useId();
  const { tab, filters, query } = view;
  const rows = searchRows(list.rows, query);
  const counts = { mine: summary.mine, unassigned: summary.unassigned };
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
          {onStart && (
            <Button
              icon="plus"
              className="inbox-start-button"
              aria-label={t('inboxSend.start.button')}
              title={t('inboxSend.start.button')}
              onClick={onStart}
            />
          )}
        </div>
        <div role="tablist" aria-label={t('inbox.list.views')} className="inbox-tabs">
          {TABS.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={tab === name}
              className={'inbox-tab' + (tab === name ? ' is-active' : '')}
              onClick={() => view.setTab(name)}
            >
              {t(`inbox.tab.${name}`)}
              {counts[name] > 0 && (
                <span className="inbox-tab-count">{counts[name] > 99 ? '99+' : counts[name]}</span>
              )}
            </button>
          ))}
        </div>
        <div className="inbox-filters">
          <label htmlFor={`${id}-channel`} className="sr-only">
            {t('inbox.list.channelFilter')}
          </label>
          <select
            id={`${id}-channel`}
            value={filters.channel}
            onChange={(event) => view.setFilter('channel', event.target.value)}
          >
            <option value="">{t('inbox.list.allChannels')}</option>
            {CHANNELS.map((name) => (
              <option key={name} value={name}>
                {t(`inbox.channel.${name}`)}
              </option>
            ))}
          </select>
          {tab !== 'spam' && (
            <>
              <label htmlFor={`${id}-state`} className="sr-only">
                {t('inbox.list.stateFilter')}
              </label>
              <select
                id={`${id}-state`}
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
          <span className="inbox-count" aria-live="polite">
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
