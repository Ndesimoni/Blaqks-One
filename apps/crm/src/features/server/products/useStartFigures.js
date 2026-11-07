import { useEffect, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { canOpenSection } from '../access.js';
import { readMyRequests } from '../marketplace/requestsModel.js';
import { waitingSources } from '../waitingCounts.js';
import { readEnquiries } from '../website/enquiries/enquiriesModel.js';
import { isLive, listingStatus } from '../website/listings/listingsModel.js';

const ACTIVE_REQUESTS = ['open', 'full', 'paused'];
const count = (list) => (Array.isArray(list) ? list.length : 0);

/**
 * The Websites, Marketplace and Platform cards' figures (approved mockup), each read only when
 * this person may open its page; a figure that cannot be read (marketplace off, no website
 * access) stays out, and the card shows its line instead.
 */
export function useStartFigures() {
  const { api, user } = useSession();
  const [figures, setFigures] = useState({});
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const workspace = user.workspaceId;
    const read = (route, key, load) => {
      if (!canOpenSection(user, route)) return;
      load()
        .then((value) => !signal.aborted && setFigures((last) => ({ ...last, [key]: value })))
        .catch(() => {});
    };
    read('Website properties', 'liveListings', () =>
      api
        .websitePublications(workspace, signal)
        .then(
          (value) => (value?.publications ?? []).filter((p) => isLive(listingStatus(p))).length,
        ),
    );
    read('Website enquiries', 'enquiries', () =>
      api.websiteEnquiries(workspace, 1, signal).then((value) => readEnquiries(value).total),
    );
    read('My requests', 'openRequests', () =>
      api
        .marketplaceRequests(workspace, signal)
        .then(
          (value) => readMyRequests(value).filter((r) => ACTIVE_REQUESTS.includes(r.state)).length,
        ),
    );
    read('Agreements', 'agreements', () => waitingSources.Agreements.read(api, workspace, signal));
    read('Workspaces', 'companies', () =>
      api.platformCompanies(signal).then((value) => count(value?.companies)),
    );
    read('Marketplace applications', 'applications', () =>
      waitingSources.Applications.read(api, workspace, signal),
    );
    return () => controller.abort();
  }, [api, user]);
  return figures;
}
