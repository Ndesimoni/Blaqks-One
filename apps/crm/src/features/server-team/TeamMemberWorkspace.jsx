import React from 'react';

/** The member's company. No one opens another company's workspace from here (BO1). */
export function TeamMemberWorkspace({ member, owner }) {
  return (
    <div className="team-directory-workspace">
      <span>
        {member.roleId === 'admin' ? `${member.name} workspace` : owner?.name || 'This workspace'}
      </span>
    </div>
  );
}
