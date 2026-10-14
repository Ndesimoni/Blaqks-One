import React from 'react';
import { moduleLabels } from './model.js';
import { actionReview } from './actionText.js';

/** Review-step summary of record actions; deleting main records is flagged as sensitive. */
export function TeamActionReview({ form }) {
  const lines = actionReview(form, moduleLabels);
  return (
    <>
      <h4>Record actions</h4>
      {lines.length ? (
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
      )}
    </>
  );
}
