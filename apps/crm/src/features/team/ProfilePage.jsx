import React, { useId, useState } from 'react';
import { useTeam } from '../../hooks/useTeam.js';
import { useSession } from '../../hooks/useSession.js';
import { Button } from '../../components/ui/Button.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { MemberWizard } from './MemberWizard.jsx';
import { PreviewLinkDialog } from './PreviewLinkDialog.jsx';
import { RoleSummary } from './TeamFields.jsx';
import { TeamRecovery } from './TeamRecovery.jsx';
import { requestReset } from './model.js';

export function ProfilePage() {
  const { team, error, commit } = useTeam();
  const { user } = useSession();
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');
  const close = () => setDialog(null);
  if (error) return <TeamRecovery />;
  return (
    <div className="profile-settings">
      <section className="panel profile-settings-details">
        <div className="team-section-top">
          <div>
            <span className="team-preview-label">YOUR ACCOUNT</span>
            <h2>{user.name}</h2>
            <p>{user.role}</p>
          </div>
          <Button
            variant="light"
            icon="edit"
            onClick={() =>
              setDialog({
                type: 'edit',
                member: team.members.find((member) => member.id === user.id),
              })
            }
          >
            Edit my profile
          </Button>
        </div>
        <dl className="team-review">
          <div>
            <dt>Login email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Phone number</dt>
            <dd>{user.phone || 'Add your required phone number'}</dd>
          </div>
          <div>
            <dt>WhatsApp work updates</dt>
            <dd>{user.whatsappUpdates ? 'Enabled · delivery not connected' : 'Not enabled'}</dd>
          </div>
        </dl>
        {user.pendingEmail && (
          <div className="team-notice">
            <div>
              <strong>New email awaiting verification</strong>
              <p>
                {user.pendingEmail.value}. Your current login stays active until the verification
                preview is completed.
              </p>
              <Button
                variant="light"
                onClick={() => setDialog({ type: 'link', kind: 'email', member: user })}
              >
                Preview email verification
              </Button>
            </div>
          </div>
        )}
        {notice && <p role="status">{notice}</p>}
        {failure && (
          <p className="field-error" role="alert">
            {failure}
          </p>
        )}
      </section>
      <div className="profile-settings-grid">
        <section className="panel">
          <h3>Client messaging</h3>
          <p className="team-muted">Your Super Admin grants each channel independently.</p>
          {[
            ['whatsapp', 'WhatsApp', 'chat'],
            ['email', 'Email', 'note'],
          ].map(([key, label, icon]) => (
            <div className="profile-channel" key={key}>
              <Icon name={icon} size={22} />
              <div>
                <strong>{label}</strong>
                <small>
                  {user.channelAccess[key]
                    ? 'Allowed to message clients'
                    : 'Not allowed by your Super Admin'}
                </small>
                <small>
                  {key === 'email'
                    ? `Planned sender: ${user.email}`
                    : 'Planned sender: company WhatsApp'}
                </small>
              </div>
              <span className="team-connection-state">Not connected</span>
            </div>
          ))}
          <Button variant="light" onClick={() => setDialog({ type: 'connection' })}>
            How sender connection works
          </Button>
        </section>
        <section className="panel">
          <h3>Password & account access</h3>
          <p className="team-muted">
            Your password is private. The Super Admin can initiate a reset but cannot read it.
          </p>
          <Button
            variant="light"
            icon="shield"
            onClick={() => {
              try {
                const next = commit((current) => requestReset(current, user.id, user.id));
                setDialog({
                  type: 'link',
                  kind: 'reset',
                  member: next.members.find((member) => member.id === user.id),
                });
              } catch (problem) {
                setFailure(problem.message);
              }
            }}
          >
            Preview password reset
          </Button>
          <p className="team-muted">
            This frontend uses the public demo password. Real resets and email verification come
            with the backend.
          </p>
        </section>
      </div>
      <section className="panel">
        <h3>Your assigned access</h3>
        <RoleSummary
          role={team.roles.find((role) => role.id === user.roleId)}
          channelAccess={user.channelAccess}
        />
      </section>
      {dialog?.type === 'edit' && (
        <MemberWizard
          member={dialog.member}
          onClose={close}
          onSuccess={() => {
            close();
            setNotice('Profile saved. A changed email needs the verification preview.');
          }}
        />
      )}
      {dialog?.type === 'link' && (
        <PreviewLinkDialog kind={dialog.kind} member={dialog.member} onClose={close} />
      )}
      {dialog?.type === 'connection' && <ConnectionHelp onClose={close} />}
    </div>
  );
}

function ConnectionHelp({ onClose }) {
  const id = useId();
  return (
    <Drawer titleId={id} onClose={onClose}>
      <div className="drawer-top">
        <div>
          <h2 id={id}>Connect your sender accounts</h2>
          <p>Live sending needs permission and an authorized account.</p>
        </div>
      </div>
      <div className="drawer-body team-fields">
        <div className="team-access-summary">
          <h3>WhatsApp</h3>
          <p>
            Your personal phone is used for staff messages. Client messages will use a business
            WhatsApp sender connected by the Super Admin, with the team member recorded as the
            author.
          </p>
        </div>
        <div className="team-access-summary">
          <h3>Your email</h3>
          <p>
            After your Super Admin allows client email, you will authorize your own supported
            mailbox. Your login email is a contact detail; it does not give the CRM permission to
            send from that address.
          </p>
        </div>
        <p className="team-muted">
          No sender accounts are connected by this prototype. Provider authorization, message
          delivery and communication logs will be implemented with the backend.
        </p>
      </div>
      <div className="drawer-footer">
        <Button variant="light" onClick={onClose}>
          Close
        </Button>
      </div>
    </Drawer>
  );
}
