import { useEffect, useRef } from 'react';
import { defaultPropertyFilters, propertyFieldValues, selectProperties } from './selectors.js';
import { useRecords, useWorkspaceView } from '../../hooks/useWorkspace.js';

export function usePropertyDirectory() {
  const { data } = useRecords();
  const { query, setPropertyFilters, setPage, setQuery, propertyFilters, sort, page } =
    useWorkspaceView();
  const resultsRef = useRef(null);

  const all = data.Properties || [];
  const queryText = query.trim().toLowerCase();
  const fieldValues = (label) => propertyFieldValues(all, label);
  const updateFilter = (name, value) => {
    setPropertyFilters((previous) => ({ ...previous, [name]: value }));
    setPage(0);
  };
  const resetFilters = () => {
    setPropertyFilters(defaultPropertyFilters());
    setQuery('');
    setPage(0);
  };
  const f = propertyFilters;
  const result = selectProperties(data, { filters: f, query, sort });
  const pageSize = 12;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(result.length / pageSize) - 1));
  useEffect(() => {
    if (currentPage !== page) setPage(currentPage);
  }, [currentPage, page, setPage]);
  const changePage = (next) => {
    setPage(next);
    resultsRef.current?.focus({ preventScroll: true });
    resultsRef.current?.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };
  const activeCount =
    Object.entries(f).filter(([k, v]) => k !== 'purpose' && v !== '' && v !== 'All').length +
    (queryText ? 1 : 0);
  return {
    all,
    f,
    query,
    fieldValues,
    updateFilter,
    clearQuery: () => {
      setQuery('');
      setPage(0);
    },
    resetFilters,
    result,
    currentPage,
    resultsRef,
    changePage,
    activeCount,
  };
}
