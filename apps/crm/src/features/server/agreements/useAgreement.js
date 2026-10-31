import { useCallback, useEffect, useState } from 'react';

const COMMANDS = {
  send: 'sendAgreement',
  accept: 'acceptAgreement',
  decline: 'declineAgreement',
  revoke: 'revokeAgreement',
  acceptAmendment: 'acceptAgreementAmendment',
  declineAmendment: 'declineAgreementAmendment',
  complete: 'completeAgreement',
  cancel: 'cancelAgreement',
  archive: 'archiveAgreement',
  recordPayment: 'recordAgreementPayment',
  confirmPayment: 'confirmAgreementPayment',
  withdrawPayment: 'withdrawAgreementPayment',
};

/**
 * A refused command as a notice: a version conflict or a hidden agreement uses the
 * catalogue's text; another conflict (such as an expired offer) shows the server's reason.
 */
export function failureNotice(failure) {
  if (failure?.status === 409 && failure.details?.code === 'version_conflict')
    return { tone: 'error', key: 'agreements.error.stale' };
  if (failure?.status === 404) return { tone: 'error', key: 'agreements.error.gone' };
  if (failure?.status === 0) return { tone: 'error', key: 'agreements.error.offline' };
  if ([400, 409].includes(failure?.status) && failure.message)
    return { tone: 'error', message: failure.message };
  return { tone: 'error', key: 'agreements.error.failed' };
}

/**
 * One agreement with its revisions and history. Commands send the version on screen; after
 * any answer, success or refusal, the latest agreement is loaded so the screen never acts
 * on stale terms.
 */
export function useAgreement(api, workspaceId, id) {
  const [state, setState] = useState({ status: 'loading', detail: null });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const load = useCallback(
    (signal) =>
      api
        .agreement(workspaceId, id, signal)
        .then((detail) => {
          if (!detail?.agreement || !detail?.revision) throw Error('incomplete');
          setState({ status: 'ready', detail });
        })
        .catch((failure) => {
          if (failure.name === 'AbortError') return;
          setState((current) =>
            failure.status === 404
              ? { status: 'missing', detail: null }
              : { status: current.detail ? 'ready' : 'error', detail: current.detail },
          );
        }),
    [api, workspaceId, id],
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const run = async (action, revisionId) => {
    const { agreement } = state.detail;
    setBusy(true);
    setNotice(null);
    try {
      await api[COMMANDS[action]](workspaceId, agreement.id, agreement.version, revisionId);
      const namespace = ['send', 'accept', 'decline', 'revoke'].includes(action)
        ? 'agreements'
        : 'agreementLifecycle';
      setNotice({ tone: 'success', key: `${namespace}.done.${action}` });
      return true;
    } catch (failure) {
      setNotice(failureNotice(failure));
      return false;
    } finally {
      await load();
      setBusy(false);
    }
  };
  const reload = () => {
    setState((current) =>
      current.status === 'error' ? { ...current, status: 'loading' } : current,
    );
    return load();
  };
  return { ...state, busy, notice, setNotice, run, reload };
}
