import React from 'react';
import { passwordStrength } from '../../../lib/passwordPolicy.js';

const steps = [1, 2, 3, 4];

/** A four-step meter whose level never contradicts the rule list (see passwordStrength). */
export function PasswordStrength({ id, password, current, email }) {
  const { score, label } = passwordStrength(password, { current, email });
  return (
    <div className="acct-strength" data-score={score}>
      <div className="acct-strength-bar" aria-hidden="true">
        {steps.map((step) => (
          <span key={step} className={step <= score ? 'on' : ''} />
        ))}
      </div>
      <p id={id} className="acct-strength-label">
        {label ? (
          <>
            Strength: <strong>{label}</strong>
          </>
        ) : (
          'Use 12 or more characters for a strong password.'
        )}
      </p>
    </div>
  );
}
