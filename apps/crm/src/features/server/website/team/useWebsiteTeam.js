import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useServerTeam } from '../../../server-team/useServerTeam.js';
import { profileFailure, teamRows } from './websiteTeamModel.js';

/**
 * The Admin's Team tab data: current members (the Team & access source, read-only), every
 * website profile and the company's listings for live counts. Each change replaces the saved
 * profile; changes that withdraw listings on the server reload the listings.
 */
export function useWebsiteTeam(api, viewer) {
  const workspace = viewer.workspaceId || viewer.id;
  const team = useServerTeam(workspace);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    Promise.all([
      api.websiteProfiles(workspace, controller.signal),
      api.websitePublications(workspace, controller.signal),
    ])
      .then(([profiles, listings]) => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(profiles?.profiles) || !Array.isArray(listings?.publications))
          throw Error('The website team response was incomplete. Please retry.');
        setData({ profiles: profiles.profiles, publications: listings.publications });
      })
      .catch((failure) => {
        if (!controller.signal.aborted && failure.name !== 'AbortError') setError(failure.message);
      });
    return () => controller.abort();
  }, [api, workspace, attempt]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const retry = useCallback(() => {
    reload();
    team.retry();
  }, [reload, team]);
  const rows = useMemo(
    () => (data ? teamRows({ members: team.members, ...data, viewer }) : []),
    [data, team.members, viewer],
  );
  const replace = (profile) =>
    setData((current) => ({
      ...current,
      profiles: [...current.profiles.filter((entry) => entry.member !== profile.member), profile],
    }));
  /**
   * Runs one change; resolves to '' on success, the refusal (a catalogue key or the server's
   * text), or null when another change is still running.
   */
  const run = async (request, withdraws) => {
    if (running.current) return null;
    running.current = true;
    setBusy(true);
    try {
      replace((await request()).profile);
      if (withdraws) reload();
      return '';
    } catch (failure) {
      const key = profileFailure(failure);
      if (key === 'stale') reload();
      return key ? `websiteTeam.error.${key}` : failure.message;
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const save = (memberId, body) =>
    run(
      () => api.updatePublicProfile(workspace, memberId, body),
      body.active === false || body.consent === false,
    );
  const grant = (row, canPublish) =>
    run(
      () =>
        api.grantWebsitePublisher(workspace, row.member.id, {
          version: row.profile.version,
          canPublish,
        }),
      !canPublish,
    );
  return {
    rows,
    loading: team.loading || (!data && !error),
    error: team.error || error,
    retry,
    busy,
    save,
    grant,
  };
}
