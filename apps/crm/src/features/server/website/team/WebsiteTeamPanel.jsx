import React, { useState } from 'react';
import { Button } from '../../../../components/ui/Button.jsx';
import { Empty } from '../../../../components/ui/Empty.jsx';
import { Icon } from '../../../../components/ui/Icon.jsx';
import { useMediaQuery } from '../../../../hooks/useMediaQuery.js';
import { useNavigation } from '../../../../hooks/useWorkspace.js';
import { TeamDirectorySkeleton } from '../../../server-team/TeamDirectorySkeleton.jsx';
import { TeamFilterBar, teamView } from './TeamFilterBar.jsx';
import { useWebsiteTeam } from './useWebsiteTeam.js';
import { WebsiteProfileDialog, WebsiteTeamConfirm } from './WebsiteTeamDialogs.jsx';
import { WebsiteTeamCards, WebsiteTeamTable } from './WebsiteTeamList.jsx';
import { profileBody, profileForm } from './websiteTeamModel.js';

/**
 * The website team with its filter row (design queue item 22), table or phone cards, and the
 * edit, stop and hide dialogs. Every change goes through the profile and publishing APIs.
 */
export function TeamPanel({ api, user, t }) {
  const team = useWebsiteTeam(api, user);
  const mobile = useMediaQuery('(max-width: 850px)');
  const { navigate } = useNavigation();
  const [dialog, setDialog] = useState(null);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState('');
  const [view, setView] = useState({ preset: 'everyone', query: '' });
  const row = dialog && team.rows.find((entry) => entry.member.id === dialog.memberId);
  const open = (kind, target) => {
    setMessage('');
    setDone('');
    setDialog({ kind, memberId: target.member.id });
  };
  const act = async (target, pending, doneKey) => {
    setMessage('');
    setDone('');
    const result = await pending;
    if (result === null) return;
    const name = target.member.name;
    if (result) return setMessage(result.startsWith('websiteTeam.') ? t(result, { name }) : result);
    setDialog(null);
    setDone(t(`websiteTeam.done.${doneKey}`, { name }));
  };
  // Edits and Hide/Show keep another member's consent, contacts and links (owner, 2026-10-30);
  // the Admin's own Hide/Show repeats their saved links, since leaving them out clears them.
  const save = (target, form, options) =>
    team.save(target.member.id, profileBody(form, target.profile, options));
  const visible = (target, active) =>
    save(target, profileForm(target.profile), { self: target.own, active });
  const actions = {
    busy: team.busy,
    edit: (target) => open('edit', target),
    stop: (target) => open('stop', target),
    hide: (target) => open('hide', target),
    allow: (target) => act(target, team.grant(target, true), 'allowed'),
    show: (target) => act(target, visible(target, true), 'shown'),
    myProfile: () => navigate('Website profile'),
  };
  if (team.error)
    return (
      <section className="panel recovery-panel" role="alert">
        <p className="field-error">{team.error}</p>
        <Button variant="light" onClick={team.retry}>
          {t('websiteTeam.retry')}
        </Button>
      </section>
    );
  if (team.loading) return <TeamDirectorySkeleton />;
  const close = () => setDialog(null);
  const common = { row, busy: team.busy, message, onClose: close, t };
  const rows = teamView(team.rows, view);
  return (
    <>
      <div className="wt-feedback">
        <p className="wt-done" role="status">
          {done && <Icon name="check" size={15} />}
          {done}
        </p>
        {message && !row && (
          <p className="field-error" role="alert">
            {message}
          </p>
        )}
      </div>
      {team.rows.length > 0 && <TeamFilterBar view={view} onView={setView} t={t} />}
      {!rows.length ? (
        <section className="panel">
          <Empty
            title={t('websiteTeam.label')}
            detail={t(team.rows.length ? 'websiteTeam.noMatch' : 'websiteTeam.empty')}
            icon="users"
          />
        </section>
      ) : mobile ? (
        <WebsiteTeamCards rows={rows} actions={actions} t={t} />
      ) : (
        <WebsiteTeamTable rows={rows} actions={actions} t={t} />
      )}
      {row && dialog.kind === 'edit' && (
        <WebsiteProfileDialog
          {...common}
          onMyProfile={actions.myProfile}
          onSave={(form) => act(row, save(row, form, { self: row.own }), 'saved')}
        />
      )}
      {row && dialog.kind === 'stop' && (
        <WebsiteTeamConfirm
          {...common}
          kind="stop"
          onConfirm={() => act(row, team.grant(row, false), 'stopped')}
        />
      )}
      {row && dialog.kind === 'hide' && (
        <WebsiteTeamConfirm
          {...common}
          kind="hide"
          onConfirm={() => act(row, visible(row, false), 'hidden')}
        />
      )}
    </>
  );
}
