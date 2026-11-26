import React, { useId } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';

/** Who asked, and (with Manage) Mark solved or Reopen and the assignee. */
export function HelpRequestActions({ request, people, manage, busy, onChange }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`help.${key}`, vars);
  const assigneeId = useId();
  return (
    <div className="help-request-card">
      <p>
        {k('from', {
          name: request.requesterName || '—',
          role: request.requesterRole,
          company: request.company?.name || '—',
        })}
      </p>
      {manage ? (
        <div className="help-request-actions">
          <div className="field">
            <label htmlFor={assigneeId}>{k('assignee')}</label>
            <select
              id={assigneeId}
              value={request.assigneeId || ''}
              disabled={busy}
              onChange={(event) => onChange({ assigneeId: event.target.value })}
            >
              <option value="">{k('nobody')}</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant={request.state === 'solved' ? 'light' : 'primary'}
            icon={request.state === 'solved' ? 'arrow' : 'check'}
            disabled={busy}
            onClick={() => onChange({ state: request.state === 'solved' ? 'open' : 'solved' })}
          >
            {request.state === 'solved' ? k('reopen') : k('solve')}
          </Button>
        </div>
      ) : (
        <p className="help-note">{k('viewOnly')}</p>
      )}
    </div>
  );
}
