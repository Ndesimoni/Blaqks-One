import React, { useId, useState } from 'react';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { RoleSummary } from './TeamFields.jsx';
import { OWNER_ROLE } from '../../config/team.js';
import { useTeam } from '../../hooks/useTeam.js';
import { useSession } from '../../hooks/useSession.js';
import {
  memberStatus,
  renewInvitation,
  requestReset,
  setMemberStatus,
  validPhone,
} from './model.js';

export function MemberManager({ memberId, onClose, onEdit, onLink, onMessage }) {
  const { team, commit } = useTeam();
  const { user } = useSession();
  const [error, setError] = useState('');
  const id = useId();
  const member = team.members.find((entry) => entry.id === memberId);
  const action = (command, followup) => {
    try {
      const next = commit(command);
      setError('');
      followup?.(next.members.find((entry) => entry.id === memberId));
    } catch (failure) {
      setError(failure.message);
    }
  };
  const pending = ['invited', 'revoked'].includes(member.status);
  return (
    <Drawer titleId={id} className="team-manager-dialog" onClose={onClose}>
      <div className="drawer-top">
        <div>
          <div className="eyebrow">TEAM MEMBER · {memberStatus(member).toUpperCase()}</div>
          <h2 id={id}>{member.name}</h2>
          <p>{member.email}</p>
        </div>
      </div>
      <div className="drawer-body">
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <dl className="team-review">
          <div>
            <dt>Phone</dt>
            <dd>{member.phone || 'Required at activation'}</dd>
          </div>
          <div>
            <dt>WhatsApp updates</dt>
            <dd>{member.whatsappUpdates ? 'Requested · sender not connected' : 'Not enabled'}</dd>
          </div>
          {member.pendingEmail && (
            <div>
              <dt>Pending email</dt>
              <dd>{member.pendingEmail.value}</dd>
            </div>
          )}
        </dl>
        <RoleSummary
          role={team.roles.find((role) => role.id === member.roleId)}
          channelAccess={member.channelAccess}
        />
        <div className="team-manager-actions">
          <Button variant="light" icon="edit" onClick={() => onEdit(member)}>
            Edit profile & access
          </Button>
          {member.status === 'invited' && (
            <Button variant="light" icon="link" onClick={() => onLink('invite', member)}>
              Open invitation preview
            </Button>
          )}
          {pending && (
            <Button
              variant="light"
              onClick={() =>
                action(
                  (current) => renewInvitation(current, user.id, member.id),
                  (updated) => onLink('invite', updated),
                )
              }
            >
              Renew invitation preview
            </Button>
          )}
          {member.status === 'invited' && (
            <Button
              variant="danger-light"
              onClick={() => {
                if (confirm(`Revoke ${member.name}’s pending invitation?`))
                  action((current) => renewInvitation(current, user.id, member.id, true));
              }}
            >
              Revoke invitation
            </Button>
          )}
          {member.status === 'active' && (
            <Button
              variant="light"
              onClick={() =>
                action(
                  (current) => requestReset(current, user.id, member.id),
                  (updated) => onLink('reset', updated),
                )
              }
            >
              Preview password reset
            </Button>
          )}
          {member.pendingEmail && member.status === 'active' && (
            <Button variant="light" onClick={() => onLink('email', member)}>
              Preview email verification
            </Button>
          )}
          {member.roleId !== OWNER_ROLE && ['active', 'suspended'].includes(member.status) && (
            <Button
              variant={member.status === 'active' ? 'danger-light' : 'light'}
              onClick={() => {
                const status = member.status === 'active' ? 'suspended' : 'active';
                if (
                  confirm(
                    `${status === 'active' ? 'Restore' : 'Suspend'} ${member.name}’s access? Their CRM records will be kept.`,
                  )
                )
                  action((current) => setMemberStatus(current, user.id, member.id, status));
              }}
            >
              {member.status === 'active' ? 'Suspend access' : 'Restore access'}
            </Button>
          )}
          <Button
            variant="light"
            icon="chat"
            disabled={!validPhone(member.phone) || !member.whatsappUpdates}
            onClick={() => onMessage(member)}
          >
            Preview staff WhatsApp
          </Button>
        </div>
        <p className="team-muted">
          Staff WhatsApp previews use the member’s required phone number. Work updates must be
          enabled. No messages are sent.
        </p>
        {member.roleId === OWNER_ROLE && (
          <p className="team-muted">
            The Super Admin stays active. Transfer ownership before changing this account’s role.
          </p>
        )}
      </div>
      <div className="drawer-footer">
        <Button variant="light" onClick={onClose}>
          Close
        </Button>
      </div>
    </Drawer>
  );
}
