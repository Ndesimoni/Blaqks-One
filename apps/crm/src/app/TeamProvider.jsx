import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TeamContext } from './TeamContext.js';
import { teamRepository } from '../services/storage/teamRepository.js';
import { TEAM_STORAGE } from '../config/team.js';

export function TeamProvider({ children, repository = teamRepository }) {
  const [state, setState] = useState(() => repository.read());
  const current = useRef(state);
  const getTeam = useCallback(() => current.current.team, []);
  const reload = useCallback(() => {
    const next = repository.read();
    current.current = next;
    setState(next);
  }, [repository]);
  const commit = useCallback(
    (command) => {
      if (current.current.error)
        throw Error('Recover the saved team preview before making changes.');
      const result = command(current.current.team);
      let team;
      try {
        team = repository.save(result.team || result);
      } catch {
        throw Error(
          'The team changes could not be saved. Your previous team details are unchanged.',
        );
      }
      current.current = { team, error: '', raw: null };
      setState(current.current);
      return result.memberId ? { ...result, team } : team;
    },
    [repository],
  );
  useEffect(() => {
    const changed = (event) => {
      if (event.key === TEAM_STORAGE || event.key === null) reload();
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [reload]);
  const value = useMemo(
    () => ({ ...state, getTeam, commit, reload }),
    [state, getTeam, commit, reload],
  );
  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}
