import React from 'react';
import { avatarTone, initials } from '../server/profile/profileModel.js';

/** Initials, name and contact lines for one directory row or card. The heading names the row. */
export function TeamMemberIdentity({ member, children }) {
  return (
    <div className="team-member-identity">
      <span className="team-member-avatar" data-tone={avatarTone(member.id)} aria-hidden="true">
        {initials(member.name)}
      </span>
      <div className="team-member-identity-text">
        <h2>{member.name}</h2>
        <span className="team-directory-contact">{member.email}</span>
        <span className="team-directory-contact">{member.phone}</span>
      </div>
      {children}
    </div>
  );
}
