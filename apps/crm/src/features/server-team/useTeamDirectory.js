import { useMemo, useState } from 'react';
import { directoryModel } from './teamDirectoryModel.js';

const defaultFilters = (frozen) => ({
  query: '',
  role: 'all',
  status: frozen ? 'archived' : 'current',
  sort: 'asc',
});

export function useTeamDirectory(team, frozen) {
  const [filters, setFilters] = useState(() => defaultFilters(frozen));
  const [page, setPage] = useState(0);
  const effective = frozen ? { ...filters, status: 'archived' } : filters;
  const model = useMemo(
    () => directoryModel(team.members, team.roles, effective),
    [team.members, team.roles, effective.query, effective.role, effective.status, effective.sort],
  );
  const defaults = defaultFilters(frozen);
  const hasFilters = Object.keys(defaults).some((key) => effective[key] !== defaults[key]);
  const change = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(0);
  };
  const reset = () => {
    setFilters(defaultFilters(frozen));
    setPage(0);
  };
  const current = Math.min(page, Math.max(0, Math.ceil(model.filtered.length / 12) - 1));
  return { ...model, filters: effective, hasFilters, current, onPage: setPage, change, reset };
}
