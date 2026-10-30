import React from 'react';
import { Link } from 'react-router-dom';

export function TeamMemberWorkspace({ member, owner, archived }) {
  return (
    <div className="team-directory-workspace">
      <span>
        {member.roleId === 'admin' ? `${member.name} workspace` : owner?.name || 'This workspace'}
      </span>
      {member.roleId === 'admin' && (
        <Link
          className="btn btn-light"
          to={`/clients?workspace=${encodeURIComponent(member.workspaceId)}`}
        >
          {archived ? 'View archived records' : 'Open workspace'}
        </Link>
      )}
    </div>
  );
}
