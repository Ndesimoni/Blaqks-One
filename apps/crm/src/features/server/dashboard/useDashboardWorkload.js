import { useMemo, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useRecords } from '../../../hooks/useWorkspace.js';
import { useAssignees } from '../assignment/useAssignees.js';
import { filterWorkload, workloadCount, workloadModule } from './dashboardModel.js';

/**
 * Team-scope members may narrow the Dashboard to one person's workload. Assigned-only members
 * already receive only their own records, so no filter is offered to them.
 */
export function useDashboardWorkload() {
  const { user } = useSession();
  const records = useRecords();
  const module = workloadModule(user, records.scope);
  const assignees = useAssignees(module || 'Clients', Boolean(module));
  const [filter, setFilter] = useState('');
  const active = Boolean(module && filter);
  const data = useMemo(
    () => (active ? filterWorkload(records.entries, records.data, filter) : records.data),
    [active, records.entries, records.data, filter],
  );
  return {
    module,
    assignees,
    filter,
    setFilter,
    data,
    count: workloadCount(data),
    me: user?.id,
  };
}
