/**
 * Sidebar badge sources (agreements design §17, owner decision 2): Deals counts hand-overs
 * waiting for the caller's answer or approval; Agreements counts offers and listings from
 * other companies waiting for the caller's answer (record sharing R2); Leads, Clients,
 * Properties and Contacts count records a colleague shared with the caller (record sharing
 * R1). The server returns counts only.
 */
export const HANDOVERS_CHANGED = 'kws:handovers-changed';
export const SHARES_CHANGED = 'kws:shares-changed';
export const LISTING_SHARES_CHANGED = 'kws:listing-shares-changed';

/** Asks the Deals badge to refresh now, e.g. after a hand-over decision. */
export function announceHandoversChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(HANDOVERS_CHANGED));
}

const count = (value) => (Number.isSafeInteger(value) && value > 0 ? value : 0);

// The four record badges poll together, so one `GET /shares/waiting` serves them all.
const SHARED_READ_MS = 2_000;
let sharesRead = null;

function sharesWaiting(api, workspace) {
  const fresh =
    sharesRead?.api === api &&
    sharesRead.workspace === workspace &&
    Date.now() - sharesRead.at < SHARED_READ_MS;
  if (!fresh) {
    const promise = api.sharesWaiting(workspace);
    sharesRead = { api, workspace, at: Date.now(), promise };
    promise.catch(() => {
      if (sharesRead?.promise === promise) sharesRead = null;
    });
  }
  return sharesRead.promise;
}

/** Asks the Agreements badge and listing-share lists to refresh now (record sharing R2). */
export function announceListingSharesChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LISTING_SHARES_CHANGED));
}

/** Asks the share badges and panels to refresh now, e.g. after a share is sent or answered. */
export function announceSharesChanged() {
  sharesRead = null;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SHARES_CHANGED));
}

const shareSource = (collection) => ({
  read: (api, workspace) =>
    sharesWaiting(api, workspace).then((value) => count(value?.[collection])),
  labelKey: `recordShares.nav.${collection}`,
  event: SHARES_CHANGED,
});

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
      api
        .agreementsWaiting(workspace, signal)
        .then((value) => count(value?.answer) + count(value?.listings)),
    labelKey: 'handoverRequests.nav.agreements',
    event: LISTING_SHARES_CHANGED,
  },
  // Leads and Clients are one collection, so both show the leads shared with the caller.
  Leads: shareSource('Clients'),
  Clients: shareSource('Clients'),
  Properties: shareSource('Properties'),
  Contacts: shareSource('Contacts'),
});
