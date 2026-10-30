import { useCallback, useEffect, useState } from 'react';
import { apiPage, listingTitles, readEnquiries } from './enquiriesModel.js';

const EMPTY = new Map();

/** One read-only lookup; a refusal or failure leaves the generic labels in place. */
function useLookup(load, read) {
  const [value, setValue] = useState(EMPTY);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setValue(read(result));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [load, read]);
  return value;
}

const readNames = (result) =>
  new Map(
    (Array.isArray(result?.assignees) ? result.assignees : [])
      .filter((member) => member?.id && member?.name)
      .map((member) => [member.id, member.name]),
  );
const readTitles = (result) => listingTitles(result?.publications);

/**
 * Website enquiries for the Admin's own workspace, one 50-row page at a time, with listing
 * titles from the company's website listings and current member names for assignees.
 */
export function useWebsiteEnquiries(api, workspace, loadError) {
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: 'loading', rows: [], total: 0, page: 0 });
  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, status: 'loading', error: '' }));
    api
      .websiteEnquiries(workspace, apiPage(index), controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setState({ status: 'ready', ...readEnquiries(result) });
      })
      .catch((failure) => {
        if (failure.name === 'AbortError') return;
        setState((current) => ({
          ...current,
          status: 'error',
          error: failure.message || loadError,
        }));
      });
    return () => controller.abort();
  }, [api, workspace, index, attempt, loadError]);
  const titles = useLookup(
    useCallback((signal) => api.websitePublications(workspace, signal), [api, workspace]),
    readTitles,
  );
  const names = useLookup(
    useCallback((signal) => api.assignees(workspace, 'Clients', signal), [api, workspace]),
    readNames,
  );
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, titles, names, setPage: setIndex, reload };
}
