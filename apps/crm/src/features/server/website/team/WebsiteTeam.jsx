import React from 'react';
import { Button } from '../../../../components/ui/Button.jsx';
import { Empty } from '../../../../components/ui/Empty.jsx';
import { useSession } from '../../../../hooks/useSession.js';
import { useI18n } from '../../../../i18n/useI18n.js';
import { TeamDirectorySkeleton } from '../../../server-team/TeamDirectorySkeleton.jsx';
import { TeamPanel } from './WebsiteTeamPanel.jsx';
import '../../../server-team/team-people.css';
import './website-team.css';

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
