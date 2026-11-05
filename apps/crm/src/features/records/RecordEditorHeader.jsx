import React from 'react';
import { FormSliderHead } from '../../components/ui/FormSliderHead.jsx';
import { get } from '../../lib/records.js';

const nouns = {
  Properties: 'property',
  'Client care': 'touchpoint',
  'Interaction log': 'conversation',
  Shortlist: 'match',
};

/** The editor's title: Edit and the record's ID, or New and what is being added. */
function editorTitle({ module, original, lead, form, idField }) {
  if (original) return 'Edit ' + get(original, idField.name);
  if (lead) return 'New lead';
  if (module === 'Follow-ups')
    return ['Call', 'Meeting'].includes(form.calendar_activity)
      ? 'New ' + form.calendar_activity.toLowerCase()
      : 'New follow-up';
  return 'New ' + (nouns[module] || module.toLowerCase().replace(/s$/, ''));
}

/**
 * The record editor's header as the approved mockup's form slider: the title, "Fields marked
 * * are required" and the close button. A listing starts focus on its title.
 */
export function RecordEditorHeader({
  module,
  original,
  lead,
  form,
  idField,
  titleId,
  busy,
  requestClose,
}) {
  return (
    <FormSliderHead
      titleId={titleId}
      title={editorTitle({ module, original, lead, form, idField })}
      closeLabel="Close record editor"
      busy={busy}
      onClose={requestClose}
      focusTitle={module === 'Properties'}
    />
  );
}
