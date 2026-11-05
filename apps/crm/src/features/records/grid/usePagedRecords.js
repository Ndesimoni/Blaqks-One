import { useEffect } from 'react';
import { useWorkspaceView } from '../../../hooks/useWorkspace.js';

/**
 * One page of a directory's filtered records. The page is clamped after records change, for
 * example when the only record on the last page is deleted.
 */
export function usePagedRecords(records, perPage) {
  const { page, setPage } = useWorkspaceView();
  const currentPage = Math.min(page, Math.max(0, Math.ceil(records.length / perPage) - 1));
  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [page, currentPage, setPage]);
  const start = currentPage * perPage;
  return { current: records.slice(start, start + perPage), currentPage, setPage };
}
