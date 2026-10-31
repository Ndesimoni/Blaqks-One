/** Presentation only: workbook keys and server scope remain unchanged. */
export const workflowColumns = {
  'Follow-ups': [
    'Activity ID',
    'Next action',
    'Client ID',
    'Property ID',
    'Due date',
    'Task status',
    'Due-date alert',
    'Channel',
  ],
  Viewings: [
    'Viewing ID',
    'Client ID',
    'Property ID',
    'Appointment date & time',
    'Viewing status',
    'Next action',
  ],
  Shortlist: [
    'Match ID',
    'Client ID',
    'Property ID',
    'Date sent',
    'Client response',
    'Next action',
  ],
  'Interaction log': [
    'Log ID',
    'Conversation topic',
    'Client ID',
    'Property ID optional',
    'Contacted on UAE time',
    'Action due',
    'Action status',
    'Next action',
    'Channel',
  ],
  'Client care': [
    'Care ID',
    'Touchpoint type',
    'Client ID',
    'Property ID optional',
    'Next contact',
    'Task status',
    'Reminder auto',
  ],
};

export const workflowTitles = {
  'Follow-ups': 'Next action',
  Viewings: 'Client ID',
  Shortlist: 'Property ID',
  'Interaction log': 'Conversation topic',
  'Client care': 'Touchpoint type',
};

/** Mobile workflows keep all task context rather than truncating to two facts. */
export function recordCardFields(module, pick) {
  const id = pick[0];
  const title =
    pick.find((field) => field.name === workflowTitles[module]) ||
    pick.find(
      (field) => field !== id && /Full name|Listing title|Next action|Community/i.test(field.name),
    ) ||
    pick[1] ||
    id;
  const state = pick.find((field) =>
    /stage|status|tier|priority|contact type|Client response/i.test(field.name),
  );
  return { id, title, state, limit: workflowColumns[module] ? pick.length : 2 };
}
