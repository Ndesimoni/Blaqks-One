import { useMemo, useState } from 'react';
import { directoryModel } from './teamDirectoryModel.js';

export function useTeamDirectory(team, frozen) {
  const [filters, setFilters] = useState({
    query: '', role: 'all', status: frozen ? 'archived' : 'current', sort: 'asc',
  });
  const [page, setPage] = useState(0);
  const effective = frozen ? { ...filters, status: 'archived' } : filters;
  const model = useMemo(
    () => directoryModel(team.members, team.roles, effective),
    [team.members, team.roles, effective.query, effective.role, effective.status, effective.sort],
  );
  const change = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(0);
  };
  const reset = () => {
    setFilters({ query: '', role: 'all', status: frozen ? 'archived' : 'current', sort: 'asc' });
    setPage(0);
  };
  const current = Math.min(page, Math.max(0, Math.ceil(model.filtered.length / 12) - 1));
  return { ...model, filters: effective, current, onPage: setPage, change, reset };
}
