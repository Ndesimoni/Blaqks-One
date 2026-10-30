import React, { useState } from 'react';
import { Button } from '../../../../components/ui/Button.jsx';
import { Empty } from '../../../../components/ui/Empty.jsx';
import { Icon } from '../../../../components/ui/Icon.jsx';
import { useMediaQuery } from '../../../../hooks/useMediaQuery.js';
import { useSession } from '../../../../hooks/useSession.js';
import { useNavigation } from '../../../../hooks/useWorkspace.js';
import { useI18n } from '../../../../i18n/useI18n.js';
import { TeamDirectorySkeleton } from '../../../server-team/TeamDirectorySkeleton.jsx';
import { useWebsiteTeam } from './useWebsiteTeam.js';
import { WebsiteProfileDialog, WebsiteTeamConfirm } from './WebsiteTeamDialogs.jsx';
import { WebsiteTeamCards, WebsiteTeamTable } from './WebsiteTeamList.jsx';
import { profileBody, profileForm } from './websiteTeamModel.js';
import '../../../server-team/team-people.css';
import './website-team.css';

function TeamPanel({ api, user, t }) {
  const team = useWebsiteTeam(api, user);
  const mobile = useMediaQuery('(max-width: 850px)');
  const { navigate } = useNavigation();
  const [dialog, setDialog] = useState(null);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState('');
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
  const visible = (target, active) =>
    team.save(
      target.member.id,
      profileBody(profileForm(target.profile), target.profile, { active }),
    );
  const actions = {
    busy: team.busy,
    edit: (target) => open('edit', target),
    stop: (target) => open('stop', target),
    hide: (target) => open('hide', target),
    allow: (target) => act(target, team.grant(target, true), 'allowed'),
    show: (target) => act(target, visible(target, true), 'shown'),
    myProfile: () => navigate('My profile'),
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
      {!team.rows.length ? (
        <section className="panel">
          <Empty title={t('websiteTeam.label')} detail={t('websiteTeam.empty')} icon="users" />
        </section>
      ) : mobile ? (
        <WebsiteTeamCards rows={team.rows} actions={actions} t={t} />
      ) : (
        <WebsiteTeamTable rows={team.rows} actions={actions} t={t} />
      )}
      {row && dialog.kind === 'edit' && (
        <WebsiteProfileDialog
          {...common}
          onMyProfile={actions.myProfile}
          onSave={(form) =>
            act(row, team.save(row.member.id, profileBody(form, row.profile)), 'saved')
          }
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

/**
 * Website → Team (Admin only): who appears on the websites, who agreed and who may publish.
 * `site` is the saved company website, or null before the Admin saves one (Content tab).
 */
export function WebsiteTeam({ site, onGoToContent }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  return (
    <section className="wt-team" aria-labelledby="wt-team-title">
      <div className="wt-intro">
        <h2 id="wt-team-title">{t('websiteTeam.label')}</h2>
        <p>{t('websiteTeam.intro')}</p>
      </div>
      {site === undefined ? (
        <TeamDirectorySkeleton />
      ) : site ? (
        <TeamPanel api={api} user={user} t={t} />
      ) : (
        <section className="panel wt-no-site">
          <Empty
            title={t('websiteTeam.noSite.title')}
            detail={t('websiteTeam.noSite.text')}
            icon="monitor"
            action={
              <Button type="button" onClick={onGoToContent}>
                {t('websiteTeam.noSite.action')}
              </Button>
            }
          />
        </section>
      )}
    </section>
  );
}
