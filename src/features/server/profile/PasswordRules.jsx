import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { passwordRules } from '../../../lib/passwordPolicy.js';
import './password-rules.css';

/**
 * The new-password rules as the member types. Not a live region: the field references it with
 * aria-describedby, and submit errors are announced separately.
 */
export function PasswordRules({ id, password, current, email }) {
  const rules = passwordRules(password, { current, email });
  return (
    <ul id={id} className="password-rules" aria-label="Password requirements">
      {rules.map((rule) => (
        <li key={rule.id} className={rule.met ? 'met' : ''}>
          <Icon name={rule.met ? 'check' : 'close'} size={14} />
          <span>{rule.label}</span>
          <span className="sr-only">{rule.met ? ' (met)' : ' (not met yet)'}</span>
        </li>
      ))}
    </ul>
  );
}
