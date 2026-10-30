import React, { useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { deriveGettingStarted, hideChecklist, readChecklistHidden } from './getStartedModel.js';
import './get-started.css';

export function GetStartedChecklist({ workspaceId, data, company, firstName }) {
  const { navigate } = useNavigation();
  const { t } = useI18n();
  const [hidden, setHidden] = useState(() => readChecklistHidden(workspaceId));
  const tasks = useMemo(() => deriveGettingStarted(data, company), [data, company]);
  if (hidden) return null;
  const completed = tasks.filter((task) => task.complete).length;
  return (
    <section className="panel get-started" aria-labelledby="get-started-title">
      <div className="get-started-heading">
        <div>
          <p className="eyebrow">{t('signupSetup.checklistEyebrow')}</p>
          <h2 id="get-started-title">{t('signupSetup.checklistTitle', { firstName })}</h2>
          <p>{t('signupSetup.checklistBody')}</p>
        </div>
        <Button
          variant="light"
          onClick={() => {
            hideChecklist(workspaceId);
            setHidden(true);
          }}
        >
          {t('signupSetup.checklistHide')}
        </Button>
      </div>
      <p className="get-started-progress" role="status">
        {t('signupSetup.checklistProgress', { done: completed, count: tasks.length })}
      </p>
      <ul className="get-started-list">
        {tasks.map((task) => (
          <li key={task.id} data-complete={task.complete || undefined}>
            <Icon name={task.complete ? 'check' : 'arrow'} size={17} />
            <button type="button" onClick={() => navigate(task.route)}>
              {t(`signupSetup.checklist${task.id[0].toUpperCase()}${task.id.slice(1)}`)}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
