import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { StateSkeleton, StateView } from '../../../components/ui/StateView.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { HelpList } from './HelpList.jsx';
import { HelpRequestForm } from './HelpRequestForm.jsx';
import { HelpThread } from './HelpThread.jsx';
import { readRequests } from './helpModel.js';
import { useHelpThread } from './useHelpThread.js';
import { announceHelpRead } from './useHelpUnread.js';
import './help.css';

/**
 * Help for every company member (BO1c): their own requests to Blaqks One, the conversation
 * and Ask for help. Only they and the Blaqks One team read these, not their company Admin.
 */
export function HelpPage() {
  const { api, user } = useSession();
  const { t } = useI18n();
  const k = (key) => t(`help.${key}`);
  const { setToast } = useWorkspaceView();
  const ws = user.workspaceId || user.id;
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState('');
  const [asking, setAsking] = useState(false);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    api
      .myHelpRequests(ws, controller.signal)
      .then((value) => !controller.signal.aborted && setRows(readRequests(value)))
      .catch((failure) => failure.name !== 'AbortError' && setError(failure.message));
    return () => controller.abort();
  }, [api, ws, attempt]);
  const thread = useHelpThread(
    selected,
    (id, signal) => api.myHelpRequest(ws, id, signal),
    (id, body) => api.replyToHelp(ws, id, body),
  );
  const openId = thread.thread?.request.id;
  useEffect(() => {
    if (!openId) return;
    setRows((current) =>
      current?.map((row) => (row.id === openId ? { ...row, unread: false } : row)),
    );
    announceHelpRead();
  }, [openId]);
  const send = async (body) => {
    try {
      const result = await api.openHelpRequest(ws, body);
      setAsking(false);
      setSelected(result.request.id);
      setToast(k('sent'));
      reload();
      return '';
    } catch (failure) {
      return failure.message;
    }
  };
  if (error && !rows)
    return (
      <StateView tone="error" role="alert" icon="close" title={k('title')} detail={error}>
        <Button onClick={reload}>{k('retry')}</Button>
      </StateView>
    );
  if (!rows) return <StateSkeleton label={k('loading')} rows={3} />;
  return (
    <div className="page-stack help-page">
      <div className="help-head">
        <p>{k('intro')}</p>
        <Button icon="plus" onClick={() => setAsking(true)}>
          {k('ask')}
        </Button>
      </div>
      {rows.length ? (
        <div className="help-layout">
          <HelpList rows={rows} selected={selected} onSelect={setSelected} label={k('list')} />
          {thread.thread ? (
            <HelpThread
              thread={thread.thread}
              side="member"
              busy={thread.busy}
              error={thread.error}
              canReply={!thread.thread.request.closed}
              replyLabel={k('reply')}
              onReply={async (body) => (await thread.post(body)) && (reload(), true)}
            />
          ) : (
            <p className="help-pick">{thread.error || k('pick')}</p>
          )}
        </div>
      ) : (
        <StateView icon="help" title={k('none')} detail={k('noneHint')}>
          <Button icon="plus" onClick={() => setAsking(true)}>
            {k('ask')}
          </Button>
        </StateView>
      )}
      {asking && <HelpRequestForm onSend={send} onClose={() => setAsking(false)} />}
    </div>
  );
}
