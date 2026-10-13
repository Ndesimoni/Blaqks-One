import React from 'react';
import {
  RecordsContext,
  NavigationContext,
  ViewContext,
  ActionsContext,
} from '../../app/WorkspaceContext.js';
import { WorkspaceScopeContext } from '../../app/WorkspaceScopeContext.js';
import { useSession } from '../../hooks/useSession.js';
import { useWorkspaceNavigation } from '../../hooks/useWorkspaceNavigation.js';
import { useWorkspaceViewState } from '../../hooks/useWorkspaceViewState.js';
import { useServerRecords } from './useServerRecords.js';
import { useServerRecordActions } from './useServerRecordActions.js';
import { ServerShell } from './ServerShell.jsx';

export function ServerWorkspace({ owner, workspaces, refreshDirectory }) {
  const { api, user } = useSession();
  const navigation = useWorkspaceNavigation('/dashboard');
  const view = useWorkspaceViewState(navigation.route, navigation.initialQuery);
  const records = useServerRecords(api, owner.id);
  const readOnly = owner.status === 'archived';
  const actions = useServerRecordActions({
    api,
    workspaceId: owner.id,
    records,
    view,
    user,
    readOnly,
  });
  return (
    <WorkspaceScopeContext.Provider value={{ owner, refreshDirectory }}>
      <RecordsContext.Provider value={records}>
        <NavigationContext.Provider value={navigation}>
          <ViewContext.Provider value={view}>
            <ActionsContext.Provider value={actions}>
              <ServerShell owner={owner} workspaces={workspaces} />
            </ActionsContext.Provider>
          </ViewContext.Provider>
        </NavigationContext.Provider>
      </RecordsContext.Provider>
    </WorkspaceScopeContext.Provider>
  );
}
