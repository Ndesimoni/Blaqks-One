import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../../../hooks/useSession.js';
import { useRecords } from '../../../hooks/useWorkspace.js';
import { canManageTeam, canOpenSection } from '../access.js';
import { ActivityFilters } from './ActivityFilters.jsx';
import { ActivityResults } from './ActivityResults.jsx';
import { useActivityFeed } from './useActivityFeed.js';
import { useActivityMembers } from './useActivityMembers.js';
import { sectionOptions } from './activityVocabulary.js';
import {
  dubaiToday,
  effectiveRange,
  emptyFilters,
  rangeError,
  readFilters,
  requestParams,
  writeFilters,
} from './activityFilters.js';
import './activity.css';
import './activity-filters.css';
import './activity-list.css';
import './activity-repeat.css';
import './activity-states.css';

/**
 * Connected Team activity (managers) or My activity (staff). The server decides what each
 * caller may see; record names come only from records this session already loaded in scope.
 */
export function ServerActivity({ owner }) {
  const { api, user } = useSession();
  const { entries } = useRecords();
  const location = useLocation();
  const go = useNavigate();
  const manager = canManageTeam(user);
  const today = dubaiToday();
  const filters = useMemo(() => readFilters(location.search), [location.search]);
  const problem = rangeError(filters, today);
  const params = useMemo(
    () => (problem ? null : requestParams(filters, { manager }, today)),
    [problem, filters, manager, today],
  );
  const feed = useActivityFeed(api, owner.id, params);
  const people = useActivityMembers(api, owner.id, manager, user, feed.items);
  const sections = useMemo(
    () => sectionOptions(user, (name) => canOpenSection(user, name)),
    [user],
  );
  const change = (next) =>
    go(
      { pathname: location.pathname, search: writeFilters(location.search, next) },
      { replace: true },
    );
  return (
    <div className="page-stack connected-activity">
      <ActivityFilters
        filters={filters}
        range={effectiveRange(filters, today)}
        problem={problem}
        manager={manager}
        owner={owner}
        people={people}
        sections={sections}
        userId={user.id}
        onChange={change}
      />
      <ActivityResults
        feed={feed}
        entries={entries}
        userId={user.id}
        today={today}
        manager={manager}
        filtered={Object.values(filters).some(Boolean)}
        onClear={() => change(emptyFilters)}
      />
    </div>
  );
}
