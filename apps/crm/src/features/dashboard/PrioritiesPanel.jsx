import React from 'react';
import { clName, get } from '../../lib/records.js';
import { compactDate } from '../../lib/dates.js';
import { isDue } from '../../lib/crm.js';
import { TitleSection } from '../../components/ui/TitleSection.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { Empty } from '../../components/ui/Empty.jsx';
import { useNavigation, useWorkspaceActions } from '../../hooks/useWorkspace.js';
import { useRecordAccess } from '../records/useRecordAccess.js';

/** `clientName` lets connected mode label hidden linked clients without revealing them. */
export function PrioritiesPanel({ data, summary, clientName = (id) => clName(data, id) }) {
  const { navigate } = useNavigation();
  const { add, dispatchRow } = useWorkspaceActions();
  const canAdd = useRecordAccess()('Follow-ups', 'create');
  const nameOfTask = (task) => clientName(get(task, 'Client ID'));
  return (
    <section className="panel activity-panel">
      <TitleSection
        heading="Your priorities"
        caption="The next conversations worth having"
        action={
          <button className="text-action" onClick={() => navigate('Follow-ups')}>
            All tasks <Icon name="arrow" size={15} />
          </button>
        }
      />
      <div className="todo-list">
        {[...summary.dueTasks, ...summary.tasks.filter((r) => !isDue(r))]
          .slice(0, 5)
          .map((t, i) => (
            <button className="todo-row" key={i} onClick={() => dispatchRow('Follow-ups', t)}>
              <span className={'todo-indicator ' + (isDue(t) ? 'overdue' : '')}>
                <Icon name={isDue(t) ? 'bell' : 'check'} size={16} />
              </span>
              <div>
                <strong>{get(t, 'Next action') || 'Contact client'}</strong>
                <span>
                  {nameOfTask(t)} · {compactDate(get(t, 'Due date'))}
                </span>
              </div>
              <Icon name="chevron" size={16} />
            </button>
          ))}
        {!summary.tasks.length && (
          <Empty
            title="You're all caught up"
            detail={
              canAdd
                ? 'No pending follow-ups. Add one to keep momentum going.'
                : 'No pending follow-ups.'
            }
            icon="check"
          />
        )}
      </div>
      {canAdd && (
        <button className="add-inline" onClick={() => add('Follow-ups')}>
          <Icon name="plus" size={16} /> Create follow-up
        </button>
      )}
    </section>
  );
}
