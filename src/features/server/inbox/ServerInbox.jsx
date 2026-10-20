import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { ClientPanel } from './ClientPanel.jsx';
import { ConversationList } from './ConversationList.jsx';
import { ConversationView } from './ConversationView.jsx';
import { POLL_MS, listParams } from './inboxModel.js';
import { useConversation } from './useConversation.js';
import { useInboxList } from './useInboxList.js';
import { useInboxSummary } from './useInboxSummary.js';
import { useMembers } from './useMembers.js';
import './inbox-layout.css';
import './inbox-list.css';
import './inbox-rows.css';
import './inbox-states.css';
import './inbox-head.css';
import './inbox-thread.css';
import './inbox-panel.css';
import './inbox-responsive.css';

/**
 * The shared Inbox (plan U1, design Main/MobileList/States): list, conversation and client
 * panel side by side on desktop, separate screens on a phone. The open conversation lives
 * in the URL (`?conversation=`), so Back and reload keep it.
 */
export function ServerInbox({ owner }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const location = useLocation();
  const go = useNavigate();
  const [tab, setTab] = useState('mine');
  const [filters, setFilters] = useState({ channel: '', state: '' });
  const [query, setQuery] = useState('');
  const [details, setDetails] = useState(false);
  const selectedId = new URLSearchParams(location.search).get('conversation') || '';
  const select = useCallback(
    (id) => {
      const params = new URLSearchParams(location.search);
      if (id) params.set('conversation', id);
      else params.delete('conversation');
      setDetails(false);
      go({ pathname: location.pathname, search: params.size ? `?${params}` : '' });
    },
    [go, location.pathname, location.search],
  );
  const summary = useInboxSummary(api, owner.id, POLL_MS);
  const params = useMemo(() => listParams(tab, filters), [tab, filters]);
  const list = useInboxList(api, owner.id, params);
  const refreshAll = useCallback(() => {
    list.refresh();
    summary.refresh();
  }, [list, summary]);
  const conversation = useConversation(api, owner.id, selectedId, refreshAll);
  const { members, nameOf } = useMembers(api, owner.id, user);
  const view = {
    tab,
    filters,
    query,
    setQuery,
    setTab: (next) => {
      setTab(next);
      setFilters((current) => ({ ...current, state: '' }));
    },
    setFilter: (key, value) => setFilters((current) => ({ ...current, [key]: value })),
  };
  const pane = !selectedId ? 'list' : details ? 'details' : 'thread';
  // On a phone an open conversation takes the whole screen below the app header: the
  // workspace notice and page intro step aside (inbox-responsive.css) and return on Back.
  useEffect(() => {
    if (pane === 'list') return undefined;
    document.documentElement.dataset.inboxFocus = 'true';
    return () => delete document.documentElement.dataset.inboxFocus;
  }, [pane]);
  const ready = conversation.status === 'ready';
  return (
    <div className="inbox-page">
      <section
        className={`inbox-layout is-${pane}${ready ? ' has-panel' : ''}`}
        aria-label={t('inbox.title')}
      >
        <ConversationList
          view={view}
          list={list}
          summary={summary}
          selectedId={selectedId}
          onOpen={select}
        />
        <section className="inbox-conversation" aria-label={t('inbox.thread.region')}>
          <ConversationView
            conversation={conversation}
            user={user}
            channels={summary.channels}
            members={members}
            nameOf={nameOf}
            onBack={() => select('')}
            onDetails={() => setDetails(true)}
          />
        </section>
        {ready && (
          <ClientPanel conversation={conversation.data} onClose={() => setDetails(false)} />
        )}
      </section>
    </div>
  );
}
