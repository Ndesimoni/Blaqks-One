import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../hooks/useSession.js';
import { useTeam } from '../../hooks/useTeam.js';
import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { MemberWizard } from './MemberWizard.jsx';
import { RoleWizard } from './RoleWizard.jsx';
import { RoleSummary } from './TeamFields.jsx';
import { PreviewLinkDialog } from './PreviewLinkDialog.jsx';
import { MemberManager } from './MemberManager.jsx';
import { TeamRecovery } from './TeamRecovery.jsx';
import { TeamMemberTable } from './TeamMemberTable.jsx';
import { OverflowList } from '../../components/ui/OverflowList.jsx';
import { MessagePreviewDialog } from '../messaging/MessagePreviewDialog.jsx';
import { OWNER_ROLE } from '../../config/team.js';
import { memberStatus, removeRole, transferOwnership } from './model.js';

export function TeamPage() {
  const { team, error, commit } = useTeam();
  const { user } = useSession();
  const [tab, setTab] = useState('members');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');
  const close = () => setDialog(null);
  const completed = (message) => {
    close();
    setNotice(message);
    setFailure('');
  };
  if (error) return <TeamRecovery />;
  if (!team.configured)
    return (
      <section className="panel team-onboarding">
        <span className="team-large-icon">
          <Icon name="shield" size={30} />
        </span>
        <span className="team-preview-label">ONE OWNER · CLEAR ACCESS</span>
        <h2>Build your team’s workspace</h2>
        <p>
          Choose the Super Admin, add a required phone number, then invite admins, receptionists and
          staff. Every member gets the access and client messaging permissions you assign.
        </p>
        <Link className="btn btn-primary" to="/setup-preview">
          Set up Super Admin
        </Link>
        <div className="team-onboarding-roles">
          {team.roles.map((role) => (
            <div key={role.id}>
              <Icon name="person" size={20} />
              <strong>{role.name}</strong>
              <p>{role.description}</p>
            </div>
          ))}
        </div>
        <small className="team-muted">
          This is a frontend preview. Invitations and messages are not sent.
        </small>
      </section>
    );
  if (!user.managesTeam)
    return (
      <section className="panel team-flow-message">
        <h2>Team access is managed by your Super Admin</h2>
        <p>You can update your own profile and view your assigned permissions.</p>
        <Link to="/my-profile">Open my profile</Link>
      </section>
    );
  const members = team.members.filter(
    (member) =>
      (status === 'all' || memberStatus(member) === status) &&
      `${member.name} ${member.email} ${member.phone}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <div className="team-page">
      <div className="team-notice">
        <Icon name="info" size={18} />
        <p>
          Team and messaging preview. Phone numbers are required at activation; invitation emails,
          WhatsApp delivery and mailbox connections come with the backend.
        </p>
      </div>
      <div className="team-metrics">
        {[
          ['Active members', team.members.filter((member) => member.status === 'active').length],
          [
            'Pending invitations',
            team.members.filter((member) => memberStatus(member) === 'invited').length,
          ],
          ['Roles', team.roles.length],
          ['Connected senders', 0],
        ].map(([label, value]) => (
          <div className="panel" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {notice && (
        <p className="team-notice" role="status">
          {notice}
        </p>
      )}
      {failure && (
        <p className="field-error" role="alert">
          {failure}
        </p>
      )}
      <section className="panel team-directory">
        <div className="team-section-top">
          <div className="team-segmented" role="group" aria-label="Team views">
            <button
              type="button"
              aria-pressed={tab === 'members'}
              onClick={() => setTab('members')}
            >
              Members
            </button>
            <button type="button" aria-pressed={tab === 'roles'} onClick={() => setTab('roles')}>
              Roles & permissions
            </button>
          </div>
          <Button
            icon="plus"
            onClick={() => setDialog({ type: tab === 'members' ? 'invite' : 'role' })}
          >
            {tab === 'members' ? 'Invite member' : 'Create role'}
          </Button>
        </div>
        {tab === 'members' ? (
          <>
            <div className="team-filters">
              <div className="search-small">
                <Icon name="search" size={17} />
                <input
                  aria-label="Search team members"
                  placeholder="Search name, email or phone"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <select
                aria-label="Filter member status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                {['all', 'active', 'invited', 'expired', 'suspended', 'revoked'].map((value) => (
                  <option key={value} value={value}>
                    {value === 'all' ? 'All statuses' : value[0].toUpperCase() + value.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <OverflowList
              mode="scroll"
              className="team-directory-list"
              items={members}
              getKey={(member) => member.id}
              label="Team members"
              renderList={(entries, label, { close }) => (
                <TeamMemberTable
                  members={entries.map(({ item }) => item)}
                  roles={team.roles}
                  label={label}
                  onManage={(memberId) => {
                    close();
                    setDialog({ type: 'manage', memberId });
                  }}
                />
              )}
            />
            <div className="team-directory-footer">
              <span>{members.length} matching members · Exactly one active Super Admin</span>
              <Button variant="light" onClick={() => setDialog({ type: 'transfer' })}>
                Transfer ownership
              </Button>
            </div>
          </>
        ) : (
          <OverflowList
            mode="all"
            items={team.roles}
            getKey={(role) => role.id}
            label="Team roles"
            listClassName="team-role-grid"
            renderItem={(role) => (
              <article className="team-role-card">
                <div className="team-role-card-top">
                  <h3>{role.name}</h3>
                  <span className="team-preview-label">
                    {role.builtIn ? 'Template' : 'Custom role'}
                  </span>
                </div>
                <RoleSummary role={role} />
                {!role.builtIn && (
                  <div className="team-inline-actions">
                    <Button variant="light" onClick={() => setDialog({ type: 'role', role })}>
                      Edit role
                    </Button>
                    <Button
                      variant="danger-light"
                      onClick={() => {
                        if (!confirm(`Remove the custom role ${role.name}?`)) return;
                        try {
                          commit((current) => removeRole(current, user.id, role.id));
                          setNotice('Custom role removed.');
                          setFailure('');
                        } catch (problem) {
                          setFailure(problem.message);
                        }
                      }}
                    >
                      Remove role
                    </Button>
                  </div>
                )}
              </article>
            )}
          />
        )}
      </section>
      {dialog?.type === 'invite' && (
        <MemberWizard
          onClose={close}
          onSuccess={(result) => {
            const member = result.team.members.find((entry) => entry.id === result.memberId);
            setDialog({ type: 'link', kind: 'invite', member });
            setNotice('Invitation preview created. No message was sent.');
          }}
        />
      )}
      {dialog?.type === 'edit' && (
        <MemberWizard
          member={dialog.member}
          onClose={close}
          onSuccess={() => completed('Member details and assigned access updated.')}
        />
      )}
      {dialog?.type === 'role' && (
        <RoleWizard
          role={dialog.role}
          onClose={close}
          onSuccess={() => completed('Role saved. Assigned members now use its CRM permissions.')}
        />
      )}
      {dialog?.type === 'link' && (
        <PreviewLinkDialog kind={dialog.kind} member={dialog.member} onClose={close} />
      )}
      {dialog?.type === 'manage' && (
        <MemberManager
          memberId={dialog.memberId}
          onClose={close}
          onEdit={(member) => setDialog({ type: 'edit', member })}
          onLink={(kind, member) => setDialog({ type: 'link', kind, member })}
          onMessage={(member) => setDialog({ type: 'message', member })}
        />
      )}
      {dialog?.type === 'message' && (
        <MessagePreviewDialog
          channel="whatsapp"
          recipient={{ name: dialog.member.name, phone: dialog.member.phone }}
          staff
          onClose={close}
        />
      )}
      {dialog?.type === 'transfer' && (
        <TransferDialog team={team} user={user} commit={commit} onClose={close} />
      )}
    </div>
  );
}

function TransferDialog({ team, user, commit, onClose }) {
  const id = useId();
  const eligible = team.members.filter(
    (member) =>
      member.status === 'active' &&
      member.id !== user.id &&
      member.phone &&
      member.roleId !== OWNER_ROLE,
  );
  const [selected, setSelected] = useState(eligible[0]?.id || '');
  const [error, setError] = useState('');
  return (
    <Drawer titleId={id} onClose={onClose}>
      <div className="drawer-top">
        <div>
          <h2 id={id}>Transfer workspace ownership</h2>
          <p>
            The selected person becomes the only Super Admin. You retain full CRM access as an
            Admin.
          </p>
        </div>
      </div>
      <div className="drawer-body">
        <label className="team-link-field">
          New Super Admin
          <select
            aria-label="New Super Admin"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            {eligible.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name} · {member.email}
              </option>
            ))}
          </select>
        </label>
        {!eligible.length && (
          <p>Activate another member with a valid phone number before transferring ownership.</p>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="drawer-footer">
        <Button variant="light" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!selected}
          onClick={() => {
            if (
              !confirm(
                'Transfer Super Admin control to this member? Your team-management access will end.',
              )
            )
              return;
            try {
              commit((current) => transferOwnership(current, user.id, selected));
              onClose();
            } catch (failure) {
              setError(failure.message);
            }
          }}
        >
          Confirm transfer
        </Button>
      </div>
    </Drawer>
  );
}
