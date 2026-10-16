import { useMemo } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useRecords } from '../../../hooks/useWorkspace.js';
import { dubaiMonth, dubaiToday } from '../../../lib/dubaiDate.js';
import { canOpenSection } from '../access.js';
import { useDashboardTargets } from './useDashboardTargets.js';
import { useDashboardWorkload } from './useDashboardWorkload.js';
import { linkedName, selectConnectedDashboard } from './dashboardModel.js';
import { showsListingViewings, upcomingEntries } from './upcomingModel.js';

/**
 * Everything the connected Dashboard derives from this session's scoped records: figures
 * (following the workload filter), names from every visible record, upcoming and today's
 * viewings (held-listing entries only in the caller's own view) and this month's targets.
 */
export function useDashboardData(owner, finance) {
  const { api, user } = useSession();
  // Names use every record the viewer can see; only the figures follow the workload filter.
  const { data: visible, scope, referenceFor, listingViewings } = useRecords();
  const workload = useDashboardWorkload();
  const { data } = workload;
  const today = dubaiToday();
  const month = dubaiMonth();
  const performance = canOpenSection(user, 'Performance');
  const targets = useDashboardTargets(api, owner?.id, month, performance);
  const figures = useMemo(() => selectConnectedDashboard(data), [data]);
  const ownView = showsListingViewings(workload.filter, workload.me);
  const upcoming = useMemo(
    () => upcomingEntries(figures.upcoming, listingViewings, ownView),
    [figures.upcoming, listingViewings, ownView],
  );
  const allUpcoming = useMemo(
    () => upcomingEntries(figures.upcoming, listingViewings, ownView, Infinity),
    [figures.upcoming, listingViewings, ownView],
  );
  const filtered = scope === 'team' && workload.filter;
  const caption =
    scope === 'team'
      ? filtered
        ? `Figures for the selected workload${finance ? '; finance covers the whole team' : ''}`
        : 'Figures from your whole team’s records'
      : 'Figures from the records assigned to you';
  return {
    user,
    data,
    workload,
    figures,
    upcoming,
    allUpcoming,
    today,
    month,
    performance,
    targets: targets.targets,
    caption,
    clientName: (id) => linkedName(visible, referenceFor, 'Clients', id),
    propertyName: (id) => linkedName(visible, referenceFor, 'Properties', id),
  };
}
