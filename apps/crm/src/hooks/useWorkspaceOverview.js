import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTeam } from './useTeam.js';
import { useSession } from './useSession.js';
import { useRecords } from './useWorkspace.js';
import { useWorkspaceScope } from './useWorkspaceScope.js';
import { workspaceDirectory } from '../features/workspaces/model.js';
import { createScopedWorkspaceRepository } from '../services/storage/workspaceRepository.js';
import { WORKSPACE_SAVED_EVENT } from '../config/workspaces.js';

export function useWorkspaceOverview() {
  const { team } = useTeam();
  const { user } = useSession();
  const { owner } = useWorkspaceScope();
  const { db, storageError } = useRecords();
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    window.addEventListener('storage', refresh);
    window.addEventListener(WORKSPACE_SAVED_EVENT, refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener(WORKSPACE_SAVED_EVENT, refresh);
    };
  }, [refresh]);
  const snapshots = useMemo(() => {
    const owners = user.managesTeam ? workspaceDirectory(team) : [owner];
    return owners.map((entry) =>
      entry.id === owner.id
        ? { owner: entry, workspace: db, error: '', pending: Boolean(storageError) }
        : { owner: entry, ...createScopedWorkspaceRepository(entry.id).read(), pending: false },
    );
  }, [team, user.managesTeam, owner.id, db, storageError, revision]);
  return { snapshots, refresh };
}
