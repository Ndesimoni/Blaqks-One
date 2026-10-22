import { useEffect, useState } from 'react';

/**
 * The agreement recording a hand-over offer (agreements design §14): its frozen terms and
 * the version a decision must name. Older hand-overs have none (`status` `none`).
 */
export function useHandoverAgreement(api, workspaceId, handover) {
  const id = handover?.agreementId;
  const [state, setState] = useState({ status: id ? 'loading' : 'none', detail: null });
  useEffect(() => {
    if (!id) return undefined;
    const controller = new AbortController();
    api
      .agreement(workspaceId, id, controller.signal)
      .then((detail) => setState({ status: 'ready', detail }))
      .catch((failure) => {
        if (failure.name !== 'AbortError') setState({ status: 'error', detail: null });
      });
    return () => controller.abort();
  }, [api, workspaceId, id]);
  return state;
}
