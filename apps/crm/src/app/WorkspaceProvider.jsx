import React, { useMemo } from 'react';
import { useWorkspaceData } from '../hooks/useWorkspaceData.js';
import { useWorkspacePreferences } from '../hooks/useWorkspacePreferences.js';
import { useWorkspaceNavigation } from '../hooks/useWorkspaceNavigation.js';
import { useWorkspaceViewState } from '../hooks/useWorkspaceViewState.js';
import { useRecordActions } from '../hooks/useRecordActions.js';
import { selectWorkspaceSummary } from '../lib/workspace.js';
import { StorageRecovery } from '../components/ui/StorageRecovery.jsx';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../hooks/useSession.js';
import { useTeam } from '../hooks/useTeam.js';
import { resolveWorkspace, workspaceUrl } from '../features/workspaces/model.js';
import { createScopedWorkspaceRepository } from '../services/storage/workspaceRepository.js';
import { createScopedPreferencesRepository } from '../services/storage/preferencesRepository.js';
import { WorkspaceScopeContext } from './WorkspaceScopeContext.js';
import {
  RecordsContext,
  PreferencesContext,
  NavigationContext,
  ViewContext,
  ActionsContext,
} from './WorkspaceContext.js';

export function WorkspaceProvider({ children }) {
  const { user } = useSession();
  const { team } = useTeam();
  const location = useLocation();
  let owner;
  try {
    owner = resolveWorkspace(team, user, new URLSearchParams(location.search).get('workspace'));
  } catch (error) {
    return (
      <main className="recovery-page">
        <section className="panel recovery-panel">
          <h1>Workspace access is restricted</h1>
          <p>{error.message}</p>
          <Link className="btn btn-primary" to="/" replace>
            Return to my workspace
          </Link>
        </section>
      </main>
    );
  }
  return (
    <ScopedWorkspaceProvider key={`${user.id}:${owner.id}`} owner={owner}>
      {children}
    </ScopedWorkspaceProvider>
  );
}

function ScopedWorkspaceProvider({ owner, children }) {
  const { user } = useSession();
  const go = useNavigate();
  const repository = useMemo(() => createScopedWorkspaceRepository(owner.id), [owner.id]);
  const preferenceRepository = useMemo(
    () => createScopedPreferencesRepository(owner.id),
    [owner.id],
  );
  const scope = useMemo(
    () => ({
      owner,
      openWorkspace: (id, route = 'Dashboard') => go(workspaceUrl(route, id)),
    }),
    [owner.id, owner.name, owner.role, owner.status, go],
  );
  const workspace = useWorkspaceData(repository);
  const preferences = useWorkspacePreferences(preferenceRepository);
  const navigation = useWorkspaceNavigation();
  const view = useWorkspaceViewState(navigation.route, navigation.initialQuery);
  const actions = useRecordActions(workspace, view, navigation.navigate, false, owner.id);
  const summary = useMemo(() => selectWorkspaceSummary(workspace.data), [workspace.data]);
  const records = useMemo(
    () => ({
      db: workspace.db,
      setDb: workspace.setDb,
      data: workspace.data,
      summary,
      storageError: workspace.storageError,
      retryStorage: workspace.retryStorage,
    }),
    [
      workspace.db,
      workspace.setDb,
      workspace.data,
      summary,
      workspace.storageError,
      workspace.retryStorage,
    ],
  );
  const preferenceValue = useMemo(
    () => preferences,
    [preferences.settings, preferences.setSettings, preferences.preferencesError],
  );
  if (workspace.recovery.error)
    return (
      <StorageRecovery
        recovery={workspace.recovery}
        retryLoad={workspace.retryLoad}
        startEmpty={workspace.startEmpty}
        returnLink={user.managesTeam ? workspaceUrl('Workspaces', user.id) : undefined}
      />
    );
  return (
    <WorkspaceScopeContext.Provider value={scope}>
      <RecordsContext.Provider value={records}>
        <PreferencesContext.Provider value={preferenceValue}>
          <NavigationContext.Provider value={navigation}>
            <ViewContext.Provider value={view}>
              <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>
            </ViewContext.Provider>
          </NavigationContext.Provider>
        </PreferencesContext.Provider>
      </RecordsContext.Provider>
    </WorkspaceScopeContext.Provider>
  );
}
