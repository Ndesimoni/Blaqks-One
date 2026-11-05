import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { StateSkeleton, StateView } from '../../../components/ui/StateView.jsx';
import { useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { TeamInvitationLink } from '../../server-team/TeamInvitationLink.jsx';
import { PlatformStaffDialog } from './PlatformStaffDialog.jsx';
import { PlatformStaffRow } from './PlatformStaffRow.jsx';
import { usePlatformTeam } from './usePlatformTeam.js';
import './platform-team.css';

/**
 * Settings → Blaqks One team, for the Owner (BO1b): the people who work at Blaqks One, the
 * areas each may use, Invite, Edit access, Suspend and Reactivate. Nobody here ever sees a
 * company's clients, deals or messages.
 */
export function PlatformTeamPage() {
  const { t } = useI18n();
  const k = (key, vars) => t(`platformTeam.${key}`, vars);
  const team = usePlatformTeam();
  const { setToast } = useWorkspaceView();
  const [editing, setEditing] = useState(null);
  const [invitation, setInvitation] = useState(null);
  const saved = (result, name) => {
    const inviting = editing === 'new';
    setEditing(null);
    team.reload();
    if (inviting && result?.invitation) setInvitation({ ...result.invitation, name });
    else setToast(k('saved', { name }));
  };
  // Resend and Reset hand the Owner a new link; Sign out and Archive just confirm.
  const account = async (member, action) => {
    const calls = {
      signOut: team.signOut,
      reset: team.resetPassword,
      resend: team.resend,
      archive: team.archive,
    };
    const result = await calls[action](member);
    if (!result) return;
    if (result.invitation) setInvitation({ ...result.invitation, name: member.name });
    else setToast(k(action === 'archive' ? 'archived' : 'signedOut', { name: member.name }));
  };
  const toggle = async (member, active) => {
    if (await team.setActive(member, active))
      setToast(k(active ? 'reactivated' : 'suspended', { name: member.name }));
  };
  if (team.error && !team.rows)
    return (
      <StateView tone="error" role="alert" icon="close" title={k('title')} detail={team.error}>
        <Button onClick={team.reload}>{k('retry')}</Button>
      </StateView>
    );
  if (!team.rows) return <StateSkeleton label={k('loading')} rows={3} />;
  return (
    <div className="page-stack platform-team">
      <div className="platform-team-head">
        <p>{k('intro')}</p>
        <Button icon="plus" onClick={() => setEditing('new')}>
          {k('invite')}
        </Button>
      </div>
      {team.error && (
        <p className="field-error" role="alert">
          {team.error}
        </p>
      )}
      {team.rows.length ? (
        <ul className="platform-staff-list" aria-label={k('list')}>
          {team.rows.map((member) => (
            <PlatformStaffRow
              key={member.id}
              member={member}
              busy={Boolean(team.busyId)}
              onEdit={() => setEditing(member)}
              onActive={(active) => toggle(member, active)}
              onAccount={(action) => account(member, action)}
            />
          ))}
        </ul>
      ) : (
        <StateView icon="users" title={k('none')} detail={k('noneHint')} />
      )}
      <p className="platform-team-note">{k('ownerNote')}</p>
      {editing && (
        <PlatformStaffDialog
          member={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      )}
      {invitation && (
        <TeamInvitationLink invitation={invitation} onClose={() => setInvitation(null)} />
      )}
    </div>
  );
}
