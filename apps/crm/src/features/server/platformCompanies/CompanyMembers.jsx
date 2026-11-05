import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';

const TONES = { active: 'green', suspended: 'amber', pending: 'slate', archived: 'red' };

/**
 * A company's people on Blaqks One's company panel (BO1a): name, email, role and positions,
 * status and last active, with Suspend or Reactivate and Archive. Never their records.
 */
export function CompanyMembers({ list, controls, onArchive, onToast }) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`platformCompanies.${key}`, vars);
  if (list.error && !list.rows)
    return (
      <p className="field-error" role="alert">
        {list.error}
      </p>
    );
  if (!list.rows) return <p role="status">{k('membersLoading')}</p>;
  const toggle = async (member, active) => {
    if (await list.setActive(member, active))
      onToast(k(active ? 'reactivated' : 'suspended', { name: member.name }));
  };
  const action = (member, key, run, variant = 'light') => (
    <Button
      variant={variant}
      disabled={Boolean(list.busyId)}
      aria-label={k('actionNamed', { action: k(key), name: member.name })}
      onClick={run}
    >
      {k(key)}
    </Button>
  );
  return (
    <section className="company-members" aria-label={k('members')}>
      <h3>{k('members')}</h3>
      {list.error && (
        <p className="field-error" role="alert">
          {list.error}
        </p>
      )}
      <ul>
        {list.rows.map((member) => (
          <li key={member.id}>
            <div className="company-member-who">
              <strong>{member.name}</strong>
              <span>{[member.role, ...(member.positions || [])].join(' · ')}</span>
              <span>{member.email}</span>
              <span>
                {member.lastActiveAt
                  ? k('lastActive', { date: format.date(member.lastActiveAt) })
                  : k('neverActive')}
              </span>
            </div>
            <Badge tone={TONES[member.status] || 'slate'}>{k(`status.${member.status}`)}</Badge>
            {controls && member.status !== 'archived' && (
              <div className="company-member-actions">
                {member.status === 'active' &&
                  action(member, 'suspend', () => toggle(member, false))}
                {member.status === 'suspended' &&
                  action(member, 'reactivate', () => toggle(member, true))}
                {action(member, 'archive', () => onArchive(member), 'danger-light')}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
