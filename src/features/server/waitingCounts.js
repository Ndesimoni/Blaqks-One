/**
 * Sidebar badge sources (agreements design §17, owner decision 2): Deals counts hand-overs
 * waiting for the caller's answer or approval; Agreements counts offers from other companies
 * waiting for the caller's answer. The server returns counts only.
 */
export const HANDOVERS_CHANGED = 'kws:handovers-changed';

/** Asks the Deals badge to refresh now, e.g. after a hand-over decision. */
export function announceHandoversChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(HANDOVERS_CHANGED));
}

const count = (value) => (Number.isSafeInteger(value) && value > 0 ? value : 0);

export const waitingSources = Object.freeze({
  Deals: {
    read: (api, workspace, signal) =>
      api
        .handoversWaiting(workspace, signal)
        .then((value) => count(value?.answer) + count(value?.approve)),
    labelKey: 'handoverRequests.nav.deals',
    event: HANDOVERS_CHANGED,
  },
  Agreements: {
    read: (api, workspace, signal) =>
      api.agreementsWaiting(workspace, signal).then((value) => count(value?.answer)),
    labelKey: 'handoverRequests.nav.agreements',
    event: null,
  },
});
