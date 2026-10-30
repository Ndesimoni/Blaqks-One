import React from 'react';
import { moduleLabels } from './model.js';
import { actionReview } from './actionText.js';

/**
 * Review-step summary of record actions; deletes and team finance grants are flagged as
 * sensitive. The surrounding review group supplies the "Record actions" heading.
 */
export function TeamActionReview({ form }) {
  const lines = actionReview(form, moduleLabels);
  return lines.length ? (
    <dl className="team-action-review">
      {lines.map((line) => (
        <React.Fragment key={line.module}>
          <dt>{line.label}</dt>
          <dd>
            {line.text}
            {line.sensitive && (
              <>
                <br />
                <span className="team-action-flag">Sensitive: {line.sensitive}</span>
              </>
            )}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  ) : (
    <p>No connected sections, so no record actions.</p>
  );
}
