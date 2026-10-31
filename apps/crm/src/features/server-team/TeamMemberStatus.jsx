import React from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { memberStatus, STATUS_BADGE_LABELS } from './teamDirectoryModel.js';

// Each state pairs a shared badge tone with its own icon, so it never relies on colour alone.
const STATUS_STYLES = {
  active: ['green', 'check'],
  pending: ['amber', 'clock'],
  cancelled: ['red', 'close'],
  suspended: ['red', 'lock'],
  archived: ['slate', 'layers'],
};

export function TeamMemberStatus({ member }) {
  const status = memberStatus(member);
  const label = STATUS_BADGE_LABELS[status];
  const [tone, icon] = STATUS_STYLES[status];
  return (
    <span className={`badge badge-${tone} team-directory-status team-directory-status-${status}`}>
      <Icon name={icon} size={13} strokeWidth={2.2} />
      {label}
      {['suspended', 'archived'].includes(status) ? ' · Sign-in blocked' : ''}
    </span>
  );
}
