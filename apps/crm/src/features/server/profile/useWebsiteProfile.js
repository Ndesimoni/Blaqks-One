import { useCallback, useEffect, useState } from 'react';
import { liveCounts } from '../website/team/websiteTeamModel.js';

/**
 * The signed-in member's own website profile and their live listing count. Saving replaces
 * the profile; withdrawing consent or being hidden reloads the count, because the server
 * takes those listings off the website in the same change.
 */
export function useWebsiteProfile(api, workspace, memberId) {
  const [state, setState] = useState({ profile: undefined, publications: [] });
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const aborted = () => controller.signal.aborted;
    setError('');
    Promise.all([
      api.publicProfile(workspace, memberId, controller.signal),
      api.websitePublications(workspace, controller.signal).catch((failure) => {
        if (aborted()) throw failure;
        return { publications: [] };
      }),
    ])
      .then(([own, listings]) => {
        if (aborted()) return;
        if (!own || !Object.hasOwn(own, 'profile'))
          throw Error('Your website profile could not be loaded. Please retry.');
        setState({ profile: own.profile, publications: listings?.publications || [] });
      })
      .catch((failure) => {
        if (!aborted() && failure.name !== 'AbortError') setError(failure.message);
      });
    return () => controller.abort();
  }, [api, workspace, memberId, attempt]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const save = async (body) => {
    const { profile } = await api.updatePublicProfile(workspace, memberId, body);
    setState((current) => ({ ...current, profile }));
    if (!profile.consent || !profile.active) reload();
    return profile;
  };
  const { profile } = state;
  return {
    profile,
    live: profile ? liveCounts(state.publications)[profile.id] || 0 : 0,
    loading: profile === undefined && !error,
    error,
    reload,
    save,
  };
}
