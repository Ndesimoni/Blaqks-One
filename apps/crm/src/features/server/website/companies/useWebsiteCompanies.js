import { useCallback, useEffect, useRef, useState } from 'react';
import { companyRows } from './companiesModel.js';

/**
 * Company websites for the Super Admin, named from the workspace directory. A failed name
 * lookup only falls back to the website names; a failed list shows Retry. `reload()` keeps
 * the current rows on screen and resolves with the fresh rows (or null on failure).
 */
export function useWebsiteCompanies(api, loadError) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const controller = useRef(null);
  const load = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setError('');
    try {
      const [list, directory] = await Promise.all([
        api.websiteCompanies(current.signal),
        api.workspaces(current.signal).catch((failure) => {
          if (failure.name === 'AbortError') throw failure;
          return { workspaces: [] };
        }),
      ]);
      const next = companyRows(list?.sites, directory?.workspaces || []);
      if (!current.signal.aborted) setRows(next);
      return next;
    } catch (failure) {
      if (failure.name === 'AbortError') return null;
      setError(failure.message || loadError);
      return null;
    }
  }, [api, loadError]);
  useEffect(() => {
    load();
    return () => controller.current?.abort();
  }, [load]);
  /** Puts a saved site back in its row without another request. */
  const replace = useCallback((site) => {
    setRows((current) =>
      (current || []).map((row) =>
        row.workspace === site.workspace
          ? {
              ...row,
              host: site.host ?? row.host,
              active: Boolean(site.active),
              entitled: Boolean(site.entitled),
              licenceVerified: Boolean(site.licenceVerified),
              version: site.version,
            }
          : row,
      ),
    );
  }, []);
  return { rows, error, loading: rows === null && !error, reload: load, replace };
}
