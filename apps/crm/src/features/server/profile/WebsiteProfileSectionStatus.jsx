import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { profileStatus, STATUS_TONES } from '../website/team/websiteTeamModel.js';

/** Where the member stands: public or not (with live listings) and who may publish. */
export function WebsiteProfileSectionStatus({ profile, live, admin, t }) {
  const status = profileStatus(profile);
  const publishing = admin
    ? 'publishingAdmin'
    : profile?.canPublish
      ? 'publishingAllowed'
      : 'publishingAsk';
  return (
    <div className="wp-status">
      <Badge tone={STATUS_TONES[status]}>{t(`websiteTeam.own.${status}`, { count: live })}</Badge>
      <span className="wt-hint">{t(`websiteTeam.own.${publishing}`)}</span>
    </div>
  );
}
