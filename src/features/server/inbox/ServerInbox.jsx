import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { sendingMailbox } from './composerModel.js';
import { useMailbox } from '../mailbox/useMailbox.js';
import { SidePanel } from './SidePanel.jsx';
import { ConversationList } from './ConversationList.jsx';
import { ConversationView } from './ConversationView.jsx';
import { POLL_MS, canReplyOn, listParams } from './inboxModel.js';
import { StartEmail } from './StartEmail.jsx';
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
import './inbox-triage.css';
import '../chat/chat-files.css';
import './inbox-list-start.css';
import './inbox-send.css';
import './inbox-attach.css';
import './inbox-start.css';
import './saved-picker.css';
import './saved-picker-phone.css';
import './saved-manager.css';
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
  const [panel, setPanel] = useState(null);
  const selectedId = new URLSearchParams(location.search).get('conversation') || '';
  const select = useCallback(
    (id) => {
      const params = new URLSearchParams(location.search);
      if (id) params.set('conversation', id);
      else params.delete('conversation');
      setPanel(null);
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
  // A SendGrid company sends from each member's own address (E3d), else Google.
  const mailbox = sendingMailbox(useMailbox(api, owner.id).data, user.roleId === 'admin');
  const [starting, setStarting] = useState(false);
  /** New email: returns '' and opens the new conversation, or the server's message. */
  const start = async (body) => {
    try {
      const { conversationId } = await api.startConversation(owner.id, body);
      setStarting(false);
      refreshAll();
      select(conversationId);
      return '';
    } catch (failure) {
      return failure.message || 'error';
    }
  };
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
  // The Inbox is a full-height view: it always starts at the top of the page, at once.
  // A block body: newer browsers return a Promise from scrollTo, which must not reach React.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);
  // A different conversation (link, Back, reload) always opens without a side panel.
  useEffect(() => {
    setPanel(null);
  }, [selectedId]);
  const pane = !selectedId ? 'list' : panel ? 'details' : 'thread';
  const ready = conversation.status === 'ready';
  return (
    <div className="inbox-page">
      <h1 className="sr-only">{t('inbox.title')}</h1>
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
          onStart={canReplyOn(user, 'email') ? () => setStarting(true) : null}
        />
        <section className="inbox-conversation" aria-label={t('inbox.thread.region')}>
          <ConversationView
            conversation={conversation}
            user={user}
            channels={summary.channels}
            mailbox={mailbox}
            members={members}
            nameOf={nameOf}
            onBack={() => select('')}
            onPanel={setPanel}
          />
        </section>
        {ready && (
          <SidePanel
            mode={panel}
            conversation={conversation}
            onClose={() => setPanel(null)}
            onShow={setPanel}
          />
        )}
      </section>
      {starting && (
        <StartEmail mailbox={mailbox} onStart={start} onClose={() => setStarting(false)} />
      )}
    </div>
  );
}
