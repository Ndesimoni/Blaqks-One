import React from 'react';
import { get } from '../../lib/records.js';
import { Icon } from '../../components/ui/Icon.jsx';

export function RecordEditorHeader({
  module,
  original,
  lead,
  form,
  idField,
  multiStep,
  titleId,
  busy,
  requestClose,
}) {
  return (
    <div className="drawer-top">
      <div>
        <div className="eyebrow">
          {(lead ? 'Leads' : module).toUpperCase()} · {original ? 'EDIT RECORD' : 'NEW ENTRY'}
        </div>
        <h2
          id={titleId}
          tabIndex={module === 'Properties' ? -1 : undefined}
          data-initial-focus={module === 'Properties' ? true : undefined}
        >
          {original
            ? 'Edit ' + get(original, idField.name)
            : 'New ' +
              (lead
                ? 'lead'
                : {
                    Properties: 'property',
                    'Client care': 'touchpoint',
                    'Interaction log': 'conversation',
                    Shortlist: 'match',
                    'Follow-ups': ['Call', 'Meeting'].includes(form.calendar_activity)
                      ? form.calendar_activity.toLowerCase()
                      : 'follow-up',
                  }[module] || module.toLowerCase().replace(/s$/, ''))}
        </h2>
        <p>
          {multiStep
            ? 'Complete each section, then review and save your record.'
            : 'Calculated fields update automatically.'}
        </p>
      </div>
      <button
        className="icon-btn"
        aria-label="Close record editor"
        disabled={busy}
        onClick={requestClose}
      >
        <Icon name="close" size={21} />
      </button>
    </div>
  );
}
