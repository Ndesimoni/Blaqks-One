import React from 'react';
import { memberStatus, STATUS_BADGE_LABELS } from './teamDirectoryModel.js';

export function TeamMemberStatus({ member }) {
  const status = memberStatus(member);
  const label = STATUS_BADGE_LABELS[status];
  return (
    <span className={`team-directory-status team-directory-status-${status}`}>
      {label}
      {['suspended', 'archived'].includes(status) ? ' · Sign-in blocked' : ''}
    </span>
  );
}
