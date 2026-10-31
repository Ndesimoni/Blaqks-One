import React, { useId } from 'react';
import { Button } from '../../../../components/ui/Button.jsx';
import { Icon } from '../../../../components/ui/Icon.jsx';
import { useWorkspaceActions } from '../../../../hooks/useWorkspace.js';
import { useI18n } from '../../../../i18n/useI18n.js';
import { readiness } from './publishModel.js';
import './website-readiness.css';

/**
 * What the property needs before it can be published, each rule in words with a visible
 * Done/To do state (never colour or icon alone). "Edit property" opens the record editor
 * above this dialog; saved changes update the checklist.
 */
export function ReadinessList({ entry, invalid }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`websitePublish.${key}`, vars);
  const { can, edit } = useWorkspaceActions();
  const id = useId();
  const rules = readiness(entry.record);
  const missing = rules.filter((rule) => !rule.ok).length;
  return (
    <section className={`website-readiness${invalid ? ' is-invalid' : ''}`} aria-labelledby={id}>
      <div className="website-readiness-head">
        <h4 id={id}>{k('readinessTitle')}</h4>
        <p role={invalid ? 'alert' : undefined}>
          {missing ? k('readinessMissing', { count: missing }) : k('readinessDone')}
        </p>
      </div>
      <ul>
        {rules.map((rule) => (
          <li key={rule.id} className={rule.ok ? 'is-done' : 'is-needed'}>
            <Icon name={rule.ok ? 'check' : 'info'} size={16} />
            <span className="website-readiness-state">
              {k(rule.ok ? 'ruleDone' : 'ruleNeeded')}
            </span>
            <span>{k(`rule.${rule.id}`)}</span>
          </li>
        ))}
      </ul>
      {missing > 0 && can('Properties', 'edit') && (
        <Button variant="light" icon="edit" onClick={() => edit('Properties', entry.record)}>
          {k('editProperty')}
        </Button>
      )}
    </section>
  );
}
