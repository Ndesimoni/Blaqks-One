import { useEffect, useState } from 'react';
import { readHandoverPreview } from './handoverPreviewModel.js';

/**
 * The review of an open hand-over (agreements design §17): `{ status, preview }` with status
 * `loading`, `ready` or `error`. It reloads when the request's status changes, so the approver
 * sees the same request again after the receiver accepts.
 */
export function useHandoverPreview(api, workspaceId, handover) {
  const id = handover?.id;
  const status = handover?.status;
  const [state, setState] = useState({ status: id ? 'loading' : 'error', preview: null });
  useEffect(() => {
    if (!id) return undefined;
    const controller = new AbortController();
    setState({ status: 'loading', preview: null });
    api
      .handoverPreview(workspaceId, id, controller.signal)
      .then((body) => {
        if (!controller.signal.aborted)
          setState({ status: 'ready', preview: readHandoverPreview(body) });
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError' && !controller.signal.aborted)
          setState({ status: 'error', preview: null });
      });
    return () => controller.abort();
  }, [api, workspaceId, id, status]);
  return state;
}
