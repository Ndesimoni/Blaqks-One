import React, { useContext, useState } from 'react';
import { WorkspaceScopeContext } from '../../app/WorkspaceScopeContext.js';
import { useSession } from '../../hooks/useSession.js';
import { useServerTeam } from './useServerTeam.js';
import { TeamMemberDialog } from './TeamMemberDialog.jsx';
import { TeamInvitationLink } from './TeamInvitationLink.jsx';
import { useTeamMemberActions } from './useTeamMemberActions.js';
import { TeamDirectoryResults } from './TeamDirectoryResults.jsx';
import { TeamDirectoryToolbar } from './TeamDirectoryToolbar.jsx';
import { TeamArchiveDialog } from './TeamArchiveDialog.jsx';
import { useWorkspaceView } from '../../hooks/useWorkspace.js';
import { useTeamDirectory } from './useTeamDirectory.js';
import { TeamDirectoryFilters } from './TeamDirectoryFilters.jsx';
import './team.css';

export function ServerTeamPage({ owner }) {
  const { user } = useSession();
  const { refreshDirectory } = useContext(WorkspaceScopeContext);
  const canReviewArchive = user.roleId === 'super-admin';
  const frozen = owner.status === 'archived';
  const team = useServerTeam(owner.id, canReviewArchive);
  const directory = useTeamDirectory(team, frozen);
  const archived = directory.filters.status === 'archived';
  const { setToast } = useWorkspaceView();
  const [editing, setEditing] = useState(null);
  const [invitation, setInvitation] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const completed = (result) => {
    setEditing(null);
    if (result.invitation) setInvitation({ ...result.invitation, name: result.member.name });
    team.retry();
    refreshDirectory?.();
  };
  const canInviteAdmin = user.roleId === 'super-admin' && owner.id === 'super-admin-workspace';
  const memberActions = useTeamMemberActions(owner.id, completed);
  return (
    <section className="connected-team" aria-label="Workspace team">
      <TeamDirectoryToolbar
        owner={owner}
        archived={archived}
        busy={team.loading || !!team.error || !!memberActions.pendingId}
        onInvite={() => setEditing({ member: null })}
      />
      <TeamDirectoryFilters
        directory={directory}
        roles={team.roles}
        canReviewArchive={canReviewArchive}
        frozen={frozen}
        busy={team.loading || !!memberActions.pendingId}
      />
      {memberActions.error && (
        <p className="field-error" role="alert">
          {memberActions.error}
        </p>
      )}
      <TeamDirectoryResults
        team={team}
        owner={owner}
        filtered={directory.filtered}
        query={directory.filters.query}
        hasFilters={directory.hasFilters}
        archived={archived}
        current={directory.current}
        onPage={directory.onPage}
        onEdit={(member) => setEditing({ member })}
        actions={memberActions}
        onDelete={user.roleId === 'super-admin' ? setDeleting : undefined}
      />
      {editing && (
        <TeamMemberDialog
          member={editing.member}
          roles={team.roles}
          workspaceId={owner.id}
          canInviteAdmin={canInviteAdmin}
          onClose={() => setEditing(null)}
          onSaved={completed}
        />
      )}
      {invitation && (
        <TeamInvitationLink invitation={invitation} onClose={() => setInvitation(null)} />
      )}
      {deleting && (
        <TeamArchiveDialog
          workspaceId={owner.id}
          member={deleting}
          onClose={({ refresh }) => {
            setDeleting(null);
            if (refresh) {
              team.retry();
              refreshDirectory?.();
            }
          }}
          onArchived={() => {
            setDeleting(null);
            completed({});
            setToast('Account archived. Saved data is available in the read-only archive.');
          }}
        />
      )}
    </section>
  );
}
