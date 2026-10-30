import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useWorkspaceScope } from '../../../hooks/useWorkspaceScope.js';

const PAUSE = 1000;
// Saves still on their way when a conversation's form closed: reopening waits for them.
const leaving = new Map();

/**
 * The member's private draft of a reply (docs/saved-replies-drafts.md §5): restored into an
 * empty box, saved a second after typing stops and when the conversation or page closes
 * (a `keepalive` request with the usual CSRF check, review M4), never kept in the browser.
 * Each save names the revision it builds on. While a reply is being sent nothing is saved,
 * and nothing is scheduled once the form has closed, so sent text never returns (H1).
 */
export function useDraft(conversationId, text, setText) {
  const { api } = useSession();
  const { owner } = useWorkspaceScope();
  const workspace = owner.id;
  const [status, setStatus] = useState('');
  const revision = useRef(0);
  const savedText = useRef('');
  const theirs = useRef('');
  const latest = useRef(text);
  const ready = useRef(false);
  const sending = useRef(false);
  const held = useRef(false);
  const timer = useRef(null);
  const inflight = useRef(null);
  latest.current = text;
  const take = (draft) => {
    revision.current = draft.revision;
    savedText.current = draft.body ?? '';
  };
  const refresh = useCallback(
    async () => (await api.draft(workspace, conversationId)).draft,
    [api, workspace, conversationId],
  );
  useEffect(() => {
    const controller = new AbortController();
    ready.current = false;
    Promise.resolve(leaving.get(conversationId))
      .then(() => api.draft(workspace, conversationId, controller.signal))
      .then(({ draft }) => {
        take(draft);
        if (draft.body && !latest.current) {
          setText(draft.body);
          setStatus('saved');
        }
        ready.current = true;
      })
      // A draft that cannot load leaves the box as it is; saving tries again later.
      .catch(() => {
        ready.current = !controller.signal.aborted;
      });
    return () => controller.abort();
  }, [api, workspace, conversationId, setText]);
  const save = useCallback(
    async (keepalive = false) => {
      clearTimeout(timer.current);
      const body = latest.current;
      if (!ready.current || sending.current || held.current || body === savedText.current) return;
      const run = (async () => {
        try {
          const base = { body, baseRevision: revision.current };
          const saved = await api.saveDraft(workspace, conversationId, base, keepalive);
          revision.current = saved.revision;
          savedText.current = body;
          setStatus(body.trim() ? 'saved' : '');
        } catch (failure) {
          if (failure.details?.code !== 'version_conflict') return setStatus('failed');
          // Changed in another window or sent there: the member chooses which to keep.
          const draft = await refresh().catch(() => null);
          if (!draft) return setStatus('failed');
          revision.current = draft.revision;
          theirs.current = draft.body ?? '';
          held.current = true;
          setStatus('changed');
        }
      })();
      inflight.current = run;
      await run;
      if (inflight.current === run) inflight.current = null;
    },
    [api, workspace, conversationId, refresh],
  );
  useEffect(() => {
    if (!ready.current || text === savedText.current) return undefined;
    setStatus((current) => (['failed', 'changed'].includes(current) ? current : ''));
    timer.current = setTimeout(() => save(), PAUSE);
    return () => clearTimeout(timer.current);
  }, [text, save]);
  useEffect(() => {
    const leave = () => {
      const run = save(true);
      leaving.set(conversationId, run);
      run.finally(() => leaving.get(conversationId) === run && leaving.delete(conversationId));
    };
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, [save, conversationId]);
  return {
    status,
    retry: () => save(),
    /** The other window's version replaces what is in the box. */
    useTheirs: () => {
      held.current = false;
      savedText.current = theirs.current;
      setText(theirs.current);
      setStatus('');
    },
    /** What is in the box is kept, on top of the other window's version. */
    keepMine: () => {
      held.current = false;
      savedText.current = theirs.current;
      setStatus('');
      save();
    },
    /** Before sending: nothing waiting, nothing on its way, nothing new (review H1). */
    beforeSend: async () => {
      sending.current = true;
      clearTimeout(timer.current);
      if (inflight.current) await inflight.current;
    },
    sendFailed: () => {
      sending.current = false;
    },
    /** After a sent reply the server has emptied the draft; take its new revision. */
    sent: async () => {
      held.current = false;
      savedText.current = '';
      setStatus('');
      const draft = await refresh().catch(() => null);
      if (draft) take(draft);
      sending.current = false;
    },
  };
}
