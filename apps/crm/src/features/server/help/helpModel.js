/** Help requests (BO1c): categories, states and the shapes the screens rely on. */
export const HELP_CATEGORIES = ['account', 'billing', 'problem', 'how_to', 'idea', 'other'];
export const HELP_STATES = ['open', 'waiting', 'solved'];
export const STATE_TONES = { open: 'amber', waiting: 'green', solved: 'slate' };

export const blankRequest = () => ({ category: 'problem', subject: '', message: '' });

/** The new request's first problem as a catalogue key, or ''. */
export function requestProblem(form) {
  const subject = form.subject.trim();
  if (!subject || subject.length > 160) return 'help.errorSubject';
  const message = form.message.trim();
  if (!message || message.length > 4000) return 'help.errorMessage';
  return '';
}

export function readRequests(value) {
  if (!Array.isArray(value?.requests)) throw Error('The help requests were incomplete.');
  return value.requests;
}

export function readThread(value) {
  if (!value?.request?.id || !Array.isArray(value.messages))
    throw Error('The help request was incomplete.');
  return value;
}

/** Whether a queue row matches the search: its subject, who asked or their company. */
export function matchesQuery(row, query) {
  const wanted = String(query || '')
    .trim()
    .toLowerCase();
  if (!wanted) return true;
  const text = [row.subject, row.requesterName, row.company?.name].filter(Boolean).join(' ');
  return text.toLowerCase().includes(wanted);
}
