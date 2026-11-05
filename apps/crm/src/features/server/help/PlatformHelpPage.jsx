import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { StateSkeleton, StateView } from '../../../components/ui/StateView.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { hasPlatformArea } from '../platformAccess.js';
import { HelpList } from './HelpList.jsx';
import { HelpQueueFilters } from './HelpQueueFilters.jsx';
import { HelpRequestActions } from './HelpRequestActions.jsx';
import { HelpThread } from './HelpThread.jsx';
import { usePlatformHelp } from './usePlatformHelp.js';
import { useHelpThread } from './useHelpThread.js';
import './help.css';
import './help-queue.css';

/**
 * Platform → Help requests (BO1c): companies' questions to Blaqks One. View reads the queue
 * and threads; Manage also answers, assigns and solves. No company's records are shown.
 */
export function PlatformHelpPage() {
  const { api, user } = useSession();
  const { t } = useI18n();
  const k = (key) => t(`help.${key}`);
  const manage = hasPlatformArea(user, 'help_requests', 'manage');
  const queue = usePlatformHelp();
  const [selected, setSelected] = useState('');
  const thread = useHelpThread(
    selected,
    (id, signal) => api.helpRequest(id, signal),
    (id, body) => api.answerHelp(id, body),
  );
  const change = async (fields) => {
    try {
      await api.changeHelp(selected, { version: thread.thread.request.version, ...fields });
      thread.reload();
      queue.reload();
    } catch (failure) {
      thread.setError(failure.status === 409 ? k('conflict') : failure.message);
    }
  };
  if (queue.error && !queue.rows)
    return (
      <StateView
        tone="error"
        role="alert"
        icon="close"
        title={k('queueTitle')}
        detail={queue.error}
      >
        <Button onClick={queue.reload}>{k('retry')}</Button>
      </StateView>
    );
  if (!queue.rows) return <StateSkeleton label={k('queueLoading')} rows={4} />;
  return (
    <div className="page-stack help-page">
      <p className="help-intro">{k('queueIntro')}</p>
      <HelpQueueFilters filter={queue.filter} counts={queue.counts} onChange={queue.setFilter} />
      <div className="help-layout">
        {queue.rows.length ? (
          <HelpList
            rows={queue.rows}
            selected={selected}
            onSelect={setSelected}
            label={k('queueTitle')}
            from
          />
        ) : (
          <StateView icon="help" title={k('queueNone')} detail={k('queueNoneHint')} />
        )}
        {thread.thread ? (
          <HelpThread
            thread={thread.thread}
            side="platform"
            busy={thread.busy}
            error={thread.error}
            canReply={manage}
            replyLabel={k('answer')}
            onReply={async (body) => (await thread.post(body)) && (queue.reload(), true)}
          >
            <HelpRequestActions
              request={thread.thread.request}
              people={queue.people}
              manage={manage}
              busy={thread.busy}
              onChange={change}
            />
          </HelpThread>
        ) : (
          <p className="help-pick">{thread.error || k('pick')}</p>
        )}
      </div>
    </div>
  );
}
