import React, { useId, useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { TeamAccountActions } from './TeamAccountActions.jsx';

export function TeamMemberActions({ member, roles, actions, onEdit, onDelete, archived }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  if (archived) return <span className="muted">Read-only</span>;
  const cancelled = member.invitationPending && member.status !== 'invited';
  const choose = (callback) => {
    setOpen(false);
    callback(member);
  };
  const runActions = {
    ...actions,
    suspend: () => choose(actions.suspend),
    restore: () => choose(actions.restore),
  };
  return (
    <>
      <Button
        variant="light"
        disabled={!!actions.pendingId}
        onClick={() => setOpen(true)}
        aria-label={`More actions for ${member.name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        More actions
      </Button>
      {open && (
        <Drawer className="team-directory-actions" titleId={titleId} onClose={() => setOpen(false)}>
          <div className="drawer-top">
            <div>
              <h2 id={titleId}>{member.name} account actions</h2>
              <p>{member.email}</p>
            </div>
            <Button
              variant="light"
              onClick={() => setOpen(false)}
              aria-label="Close account actions"
            >
              Close
            </Button>
          </div>
          <div className="drawer-body">
            <p>
              {member.roleId === 'admin'
                ? 'Admin · Own workspace'
                : member.positions
                    .map((id) => roles.find((role) => role.id === id)?.label || id)
                    .join(', ')}
            </p>
            <p>
              {member.channelAccess?.email ? 'Email access allowed' : 'Email access restricted'} ·{' '}
              {member.channelAccess?.whatsapp
                ? 'WhatsApp access allowed'
                : 'WhatsApp access restricted'}
            </p>
            <div className="team-directory-action-list">
              <Button
                variant="light"
                onClick={() => choose(onEdit)}
                aria-label={`Edit ${member.name}`}
              >
                Edit
              </Button>
              {member.invitationPending ? (
                <>
                  <Button
                    variant="light"
                    onClick={() => choose(actions.renew)}
                    aria-label={`Renew invitation for ${member.name}`}
                  >
                    Renew invitation
                  </Button>
                  {!cancelled && (
                    <Button
                      variant="danger-light"
                      onClick={() => choose(actions.cancel)}
                      aria-label={`Cancel invitation for ${member.name}`}
                    >
                      Cancel invitation
                    </Button>
                  )}
                  <p>
                    {cancelled
                      ? 'The previous link is disabled. Renew to create a new invitation.'
                      : 'Renewing replaces the previous link. You can cancel before acceptance.'}
                  </p>
                </>
              ) : (
                <TeamAccountActions member={member} actions={runActions} />
              )}
            </div>
            {onDelete && (
              <div className="team-directory-danger-action">
                <p>Deleting archives this account and preserves saved records.</p>
                <Button
                  variant="danger-light"
                  icon="trash"
                  onClick={() => choose(onDelete)}
                  aria-label={`Delete account for ${member.name}`}
                >
                  Delete account
                </Button>
              </div>
            )}
          </div>
        </Drawer>
      )}
    </>
  );
}
