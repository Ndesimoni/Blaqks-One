import React from 'react';
import { TeamMemberStatus } from './TeamMemberStatus.jsx';
import { TeamMemberWorkspace } from './TeamMemberWorkspace.jsx';
import { TeamMemberActions } from './TeamMemberActions.jsx';
import { TeamMemberActionNote } from './TeamMemberActionNote.jsx';
import { TeamMemberIdentity } from './TeamMemberIdentity.jsx';
import { TeamMemberPositions } from './TeamMemberPositions.jsx';

/** Phone-width directory entry: identity and status first, then labelled role and workspace. */
export function TeamMemberCard({ member, roles, owner, archived, onEdit, actions, onDelete }) {
  return (
    <article
      className="panel connected-team-card team-directory-mobile-card"
      data-member-id={member.id}
    >
      <TeamMemberIdentity member={member} />
      <div className="team-directory-card-status">
        <TeamMemberStatus member={member} />
      </div>
      <dl className="team-directory-card-details">
        <div>
          <dt>Role</dt>
          <dd>
            <TeamMemberPositions member={member} roles={roles} />
          </dd>
        </div>
        <div>
          <dt>Workspace</dt>
          <dd>
            <TeamMemberWorkspace member={member} owner={owner} archived={archived} />
          </dd>
        </div>
      </dl>
      {archived && <TeamMemberActionNote member={member} />}
      {archived && <p className="muted">Records are retained. This account cannot be changed.</p>}
      <div className="team-directory-card-actions">
        <TeamMemberActions
          member={member}
          roles={roles}
          actions={actions}
          onEdit={onEdit}
          onDelete={onDelete}
          archived={archived}
        />
      </div>
    </article>
  );
}
