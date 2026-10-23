import React, { useMemo } from 'react';
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
import { DealLinkField } from './dealLinks/DealLinkField.jsx';
import { ServerMediaProvider } from './media/ServerMediaProvider.jsx';
import { withKept } from './keptRecords.js';
import { shareRoute } from './shares/shareModel.js';
import { listingShareRoute } from './listingShares/listingShareLinks.js';

/** Share links: a colleague's share (R1) or a listing from another company (R2). */
const linkRoute = (pathname) => shareRoute(pathname) || listingShareRoute(pathname);

/** Connected pickers for link fields whose targets are not workspace records. */
const linkFields = Object.freeze({ 'Deal ID': DealLinkField });

export function ServerWorkspace({ owner, workspaces, refreshDirectory }) {
  const { api, user } = useSession();
  // `#/shares/{id}` and `#/listing-shares/{id}` open shares; nothing else matches them.
  const navigation = useWorkspaceNavigation('/dashboard', linkRoute);
  const view = useWorkspaceViewState(navigation.route, navigation.initialQuery);
  const records = { ...useServerRecords(api, owner.id), linkFields };
  const readOnly = owner.status === 'archived';
  // Kept listings show their photos too (agreements design §18).
  const { entries, keptEntries } = records;
  const mediaEntries = useMemo(
    () => withKept(entries, keptEntries, ['Properties']),
    [entries, keptEntries],
  );
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
              <ServerMediaProvider api={api} workspaceId={owner.id} entries={mediaEntries}>
                <ServerShell owner={owner} workspaces={workspaces} />
              </ServerMediaProvider>
            </ActionsContext.Provider>
          </ViewContext.Provider>
        </NavigationContext.Provider>
      </RecordsContext.Provider>
    </WorkspaceScopeContext.Provider>
  );
}
