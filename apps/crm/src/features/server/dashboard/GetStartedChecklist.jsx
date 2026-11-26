import React, { useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { deriveGettingStarted, hideChecklist, readChecklistHidden } from './getStartedModel.js';
import './get-started.css';

const label = (id) => `signupSetup.checklist${id[0].toUpperCase()}${id.slice(1)}`;

/**
 * Get started, as the approved mockup draws it on the start page (design queue item 35): how
 * many steps are done, a progress bar and one row per step, ticked when done or with Start.
 * Hide keeps it hidden in this browser.
 */
export function GetStartedChecklist({ workspaceId, data, company }) {
  const { navigate } = useNavigation();
  const { t } = useI18n();
  const [hidden, setHidden] = useState(() => readChecklistHidden(workspaceId));
  const tasks = useMemo(() => deriveGettingStarted(data, company), [data, company]);
  if (hidden) return null;
  const done = tasks.filter((task) => task.complete).length;
  return (
    <section className="panel get-started" aria-labelledby="get-started-title">
      <div className="get-started-head">
        <h2 id="get-started-title">{t('signupSetup.checklistTitle')}</h2>
        <span role="status">
          {t('signupSetup.checklistProgress', { done, count: tasks.length })}
        </span>
        <button
          type="button"
          className="start-tour-link"
          onClick={() => {
            hideChecklist(workspaceId);
            setHidden(true);
          }}
        >
          {t('signupSetup.checklistHide')}
        </button>
      </div>
      <div className="get-started-meter" aria-hidden="true">
        <span style={{ inlineSize: `${(done / tasks.length) * 100}%` }} />
      </div>
      <ul className="get-started-list">
        {tasks.map((task) => (
          <li key={task.id} data-complete={task.complete || undefined}>
            <span className="get-started-tick" aria-hidden="true">
              {task.complete && <Icon name="check" size={13} />}
            </span>
            <span className="get-started-what">{t(label(task.id))}</span>
            {task.complete ? (
              <span className="get-started-done">{t('signupSetup.checklistDone')}</span>
            ) : (
              <Button
                variant="light"
                aria-label={`${t('signupSetup.checklistStart')}: ${t(label(task.id))}`}
                onClick={() => navigate(task.route)}
              >
                {t('signupSetup.checklistStart')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
