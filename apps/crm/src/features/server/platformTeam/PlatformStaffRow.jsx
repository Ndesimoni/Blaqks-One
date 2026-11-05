import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { StaffAccountControls } from './StaffAccountControls.jsx';

const TONES = { active: 'green', suspended: 'amber', pending: 'slate', archived: 'red' };

/** One Blaqks One team member: role, areas, status and last active, with their actions. */
export function PlatformStaffRow({ member, busy, onEdit, onActive, onAccount }) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`platformTeam.${key}`, vars);
  const action = (key, run) => (
    <Button
      variant="light"
      disabled={busy}
      aria-label={k('actionNamed', { action: k(key), name: member.name })}
      onClick={run}
    >
      {k(key)}
    </Button>
  );
  return (
    <li className="platform-staff">
      <div className="platform-staff-who">
        <strong>{member.name}</strong>
        <span>
          {k(`preset.${member.preset}`)} · {member.email}
        </span>
        <span>
          {member.lastActiveAt
            ? k('lastActive', { date: format.date(member.lastActiveAt) })
            : k('neverActive')}
        </span>
        <ul className="platform-staff-areas" aria-label={k('areas')}>
          {Object.entries(member.access || {}).map(([area, level]) => (
            <li key={area}>
              {k(`area.${area}`)} · {k(`level.${level}`)}
            </li>
          ))}
        </ul>
      </div>
      <Badge tone={TONES[member.status] || 'slate'}>{k(`status.${member.status}`)}</Badge>
      {member.status !== 'archived' && (
        <div className="platform-staff-actions">
          {action('edit', onEdit)}
          {member.status === 'active' && action('suspend', () => onActive(false))}
          {member.status === 'suspended' && action('reactivate', () => onActive(true))}
          <StaffAccountControls member={member} busy={busy} run={onAccount} />
        </div>
      )}
    </li>
  );
}
