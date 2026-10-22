import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { readEarnPreview, readFinanceApprovers, readFinanceAssignees } from './dealResponses.js';
import { readFinanceOverview } from './financeModel.js';
import { readHistory } from './historyModel.js';

/** The connected finance page state: `{ api, workspaceId, user, finance, actions, ... }`. */
export const FinanceContext = createContext(null);

export function useFinanceContext() {
  const context = useContext(FinanceContext);
  if (!context) throw Error('useFinanceContext must be used within FinanceContent.');
  return context;
}

const idle = { value: null, loading: false, error: '' };

/**
 * One cancellable read: `load(signal)` runs whenever `key` changes while `enabled`. The
 * previous value clears on every change, so another deal's or agent's figures never linger.
 */
function useRead(load, key, enabled) {
  const [state, setState] = useState(idle);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setState(enabled ? { value: null, loading: true, error: '' } : idle);
    if (!enabled) return undefined;
    const controller = new AbortController();
    load(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setState({ value, loading: false, error: '' });
      })
      .catch((failure) => {
        if (failure.name === 'AbortError' || controller.signal.aborted) return;
        setState({ value: null, loading: false, error: failure.message });
      });
    return () => controller.abort();
    // `load` is rebuilt each render; `key` carries everything it reads.
  }, [key, enabled, attempt]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, retry };
}

/** Members who can hold deals; needs finance Hand on or team finance (§13 L-F8). */
export function useFinanceAssignees(api, workspaceId, access) {
  const enabled = access.assign || access.teamView;
  const read = useRead(
    async (signal) => readFinanceAssignees(await api.financeAssignees(workspaceId, signal)),
    `${workspaceId}`,
    enabled,
  );
  return { people: read.value ?? [], loading: read.loading, error: read.error, retry: read.retry };
}

/** Who may approve a hand-over (`GET /finance/approvers`), read only once `enabled`. */
export function useFinanceApprovers(api, workspaceId, enabled) {
  const read = useRead(
    async (signal) => readFinanceApprovers(await api.financeApprovers(workspaceId, signal)),
    `${workspaceId}`,
    enabled,
  );
  return { people: read.value ?? [], loading: read.loading, error: read.error };
}

/** A chosen agent's commission statement (team view only, `GET /finance?agent=`). */
export function useAgentStatement(api, workspaceId, access, agent) {
  const enabled = access.scope === 'team' && Boolean(agent);
  return useRead(
    async (signal) =>
      readFinanceOverview(await api.financeOverview(workspaceId, { agent }, signal)).statement,
    `${workspaceId}:${agent}`,
    enabled,
  );
}

/** What earning `deal` on `earnedOn` would record (approvers; nothing is written). */
export function useEarnPreview(api, workspaceId, access, deal, earnedOn) {
  const enabled = Boolean(deal && /^\d{4}-\d{2}-\d{2}$/.test(earnedOn ?? ''));
  return useRead(
    async (signal) =>
      readEarnPreview(
        await api.earnPreview(workspaceId, deal, earnedOn, signal),
        access.scope === 'team',
      ),
    `${workspaceId}:${deal?.id}:${deal?.version}:${earnedOn}`,
    enabled,
  );
}

/** One deal's, payment's or expense's history; reloads when the row's version changes. */
export function useFinanceHistory(api, workspaceId, access, kind, row) {
  return useRead(
    async (signal) =>
      readHistory(
        await api.financeHistory(workspaceId, kind, row.id, signal),
        access.scope === 'team',
      ),
    `${workspaceId}:${kind}:${row?.id}:${row?.version}`,
    Boolean(row) && access.scope !== 'none',
  );
}
