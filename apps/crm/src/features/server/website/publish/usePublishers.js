import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../../../hooks/useSession.js';
import { eligibleProfiles } from './publishModel.js';

/** Profiles: the company's for an Admin (or the Admin's own until that list exists), else own. */
function readProfiles(api, workspace, userId, admin, signal) {
  if (admin && typeof api.websiteProfiles === 'function')
    return api.websiteProfiles(workspace, signal).then((value) => value?.profiles || []);
  return api
    .publicProfile(workspace, userId, signal)
    .then((value) => (value?.profile ? [value.profile] : []));
}

/**
 * Who may represent a listing, and the company site for destination choices. An Admin
 * reads the company site unless the caller passes it (`site` not undefined); staff cannot
 * read it, so for them `site` stays undefined and the server decides.
 */
export function usePublishers(site, enabled = true) {
  const { api, user } = useSession();
  const workspace = user.workspaceId || user.id;
  const admin = user.roleId === 'admin';
  const readSite = admin && site === undefined;
  const [state, setState] = useState({ loaded: false, error: '', profiles: [], site: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    const signal = controller.signal;
    setState((previous) => ({ ...previous, error: '' }));
    const siteRead = readSite
      ? api.companyWebsite(workspace, signal).then((value) => value?.site ?? null)
      : Promise.resolve(null);
    Promise.all([readProfiles(api, workspace, user.id, admin, signal), siteRead])
      .then(([profiles, company]) => {
        if (!signal.aborted) setState({ loaded: true, error: '', profiles, site: company });
      })
      .catch((error) => {
        if (error.name !== 'AbortError')
          setState((previous) => ({ ...previous, loaded: true, error: error.message }));
      });
    return () => controller.abort();
  }, [api, workspace, user.id, admin, readSite, enabled, attempt]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return {
    loading: enabled && !state.loaded,
    error: state.error,
    profiles: state.profiles,
    eligible: eligibleProfiles(state.profiles, admin ? user.id : null),
    site: readSite ? state.site : site,
    admin,
    retry,
  };
}
