import React from 'react';
import { OverflowList } from '../../components/ui/OverflowList.jsx';
import { TeamMemberStatus } from './TeamMemberStatus.jsx';
import { TeamMemberWorkspace } from './TeamMemberWorkspace.jsx';
import { TeamMemberActions } from './TeamMemberActions.jsx';

export function TeamMemberCard({ member, roles, owner, archived, onEdit, actions, onDelete }) {
  const names = member.positions.map((id) => roles.find((role) => role.id === id)?.label || id);
  return (
    <article
      className="panel connected-team-card team-directory-mobile-card"
      data-member-id={member.id}
    >
      <div className="connected-team-card-heading">
        <h2>{member.name}</h2>
        <TeamMemberActions
          member={member}
          roles={roles}
          actions={actions}
          onEdit={onEdit}
          onDelete={onDelete}
          archived={archived}
        />
      </div>
      <TeamMemberStatus member={member} />
      <p>
        {member.email}
        <br />
        {member.phone}
      </p>
      {member.roleId === 'admin' ? (
        <p>Admin</p>
      ) : (
        <OverflowList
          items={names}
          getKey={(name) => name}
          label={`${member.name} positions`}
          renderItem={(name) => <span className="connected-team-position">{name}</span>}
        />
      )}
      <TeamMemberWorkspace member={member} owner={owner} archived={archived} />
      {archived && <p className="muted">Records are retained. This account cannot be changed.</p>}
    </article>
  );
}
