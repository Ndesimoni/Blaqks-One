import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SessionContext } from './SessionContext.js';
import { createSessionRepository } from '../services/storage/sessionRepository.js';
import { signInTeamDemo } from '../services/auth/demoAuth.js';
import { memberProfile } from '../features/team/model.js';
import { useTeam } from '../hooks/useTeam.js';

export function SessionProvider({ children }) {
  const { team, getTeam } = useTeam();
  const [repository] = useState(() =>
    createSessionRepository(undefined, (id) => memberProfile(getTeam(), id)),
  );
  const [identity, setIdentity] = useState(() => repository.load()?.id || null);
  const user = useMemo(() => memberProfile(team, identity), [team, identity]);
  const enterPreview = useCallback(
    (id) => {
      if (!memberProfile(getTeam(), id)) throw Error('This account is not active.');
      try {
        repository.save(id);
      } catch {
        throw Error(
          'Your browser could not save the session. Allow browser storage and try again.',
        );
      }
      setIdentity(id);
    },
    [repository, getTeam],
  );
  const signIn = useCallback(
    (email, password) => {
      const profile = signInTeamDemo(getTeam(), email, password);
      enterPreview(profile.id);
    },
    [getTeam, enterPreview],
  );
  const signOut = useCallback(() => {
    try {
      repository.clear();
    } catch {
      throw Error('Your browser could not clear the session. Please try signing out again.');
    }
    setIdentity(null);
  }, [repository]);
  useEffect(() => {
    if (!identity || user) return;
    try {
      repository.clear();
    } catch {
      /* A denied storage read still keeps the UI signed out. */
    }
    setIdentity(null);
  }, [identity, user, repository]);
  const value = useMemo(
    () => ({ user, signIn, signOut, enterPreview }),
    [user, signIn, signOut, enterPreview],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
