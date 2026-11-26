import { useCallback, useEffect, useState } from 'react';

/**
 * Start message on WhatsApp for one record (W1b, design §18): the member's own number, the
 * client's number as the server derived it, the agreement, whether a template may start the
 * conversation and the caller's existing thread. Agreement and the start itself send that
 * number back as `expectedPhone`; when the record's number changed meanwhile the server
 * answers `phone_changed`, the state reloads and `changedText` explains it.
 */
export function useWhatsappStart(api, workspaceId, person, changedText) {
  const [state, setState] = useState({ status: 'loading', data: null });
  const [attempt, setAttempt] = useState(0);
  const { collection, id: recordId } = person;
  useEffect(() => {
    const controller = new AbortController();
    api
      .whatsappStartState(workspaceId, { collection, recordId }, controller.signal)
      .then((data) => {
        if (typeof data?.canStart !== 'boolean') throw Error('incomplete');
        setState({ status: 'ready', data });
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError') setState({ status: 'error', data: null });
      });
    return () => controller.abort();
  }, [api, workspaceId, collection, recordId, attempt]);
  const reload = useCallback(() => {
    setState((current) => (current.data ? current : { status: 'loading', data: null }));
    setAttempt((value) => value + 1);
  }, []);
  const expectedPhone = state.data?.contact?.phone ?? null;
  /** `{result, failure}`: failure is '' or the words to show. */
  const run = async (change, again) => {
    try {
      const result = await change();
      if (again) reload();
      return { result, failure: '' };
    } catch (failure) {
      if (failure.details?.code === 'phone_changed') {
        reload();
        return { failure: changedText };
      }
      return { failure: failure.message || 'error' };
    }
  };
  const target = { collection, recordId, expectedPhone };
  return {
    ...state,
    reload,
    /** The client's agreement for this record's number; resolves to '' or the reason. */
    consent: async (change) =>
      (await run(() => api.recordWhatsappConsent(workspaceId, { ...target, ...change }), true))
        .failure,
    /** Starts (or continues) the conversation with an approved template. */
    start: (template) =>
      run(() => api.startWhatsappConversation(workspaceId, { ...target, template }), false),
  };
}
