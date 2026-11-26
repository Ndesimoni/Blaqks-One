import React from 'react';
import { OverflowList } from '../../components/ui/OverflowList.jsx';

/** Role chips: Admins show one role chip; staff show up to six positions with More. */
export function TeamMemberPositions({ member, roles }) {
  if (member.roleId === 'admin')
    return <span className="connected-team-position connected-team-position-admin">Admin</span>;
  const names = member.positions.map((id) => roles.find((role) => role.id === id)?.label || id);
  return (
    <OverflowList
      items={names}
      getKey={(name) => name}
      label={`${member.name} positions`}
      className="team-member-positions"
      renderItem={(name) => <span className="connected-team-position">{name}</span>}
    />
  );
}
