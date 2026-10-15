import React from 'react';
import { TeamMemberStatus } from './TeamMemberStatus.jsx';
import { TeamMemberWorkspace } from './TeamMemberWorkspace.jsx';
import { TeamMemberActions } from './TeamMemberActions.jsx';
import { TeamMemberActionNote } from './TeamMemberActionNote.jsx';
import { TeamMemberIdentity } from './TeamMemberIdentity.jsx';
import { TeamMemberPositions } from './TeamMemberPositions.jsx';

export function TeamDirectoryTable({ members, roles, owner, archived, actions, onEdit, onDelete }) {
  return (
    <div className="table-shell team-directory-table-shell">
      <div className="table-scroll">
        <table className="data-table team-directory-table" aria-label="Team directory">
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col">Workspace</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} data-member-id={member.id}>
                <td>
                  <TeamMemberIdentity member={member} />
                </td>
                <td>
                  <TeamMemberPositions member={member} roles={roles} />
                  {archived && <TeamMemberActionNote member={member} />}
                </td>
                <td>
                  <TeamMemberStatus member={member} />
                </td>
                <td>
                  <TeamMemberWorkspace member={member} owner={owner} archived={archived} />
                </td>
                <td className="team-directory-actions-cell">
                  <TeamMemberActions
                    member={member}
                    roles={roles}
                    actions={actions}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    archived={archived}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
