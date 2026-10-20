/** Inbox rules settings text in English (docs/i18n.md). Keys are `inboxRules.<key>`. */
export default {
  title: 'Inbox rules',
  description:
    'Decide which messages become leads on their own. Everything else waits in the Inbox for a person to decide.',
  loading: 'Loading the Inbox rules…',
  loadFailed: 'The Inbox rules could not be loaded.',
  retry: 'Try again',
  always: 'Always',
  'known.title': 'Messages from existing clients and leads',
  'known.body':
    'Matched by exact phone number or email in this company. They join that person’s conversation and go to their agent. No new lead is created.',
  'auto.title': 'Create a lead automatically when…',
  'auto.sources': 'They come from one of our ads, listings, lead forms or portals',
  'auto.sourcesHint': 'Click-to-chat ads, listing links, lead forms and property portal enquiries.',
  'words.alwaysOn': 'Always on',
  'words.title': 'The first message uses property words',
  'words.hint': 'When at least two of these words appear, in English or Arabic:',
  'words.list': 'Property words',
  'words.remove': 'Remove {word}',
  'words.add': 'Add word',
  'words.placeholder': 'Add a word',
  'mode.label': 'What property words do',
  'mode.suggest': 'Suggest, a person confirms',
  'mode.create': 'Create the lead straight away',
  'route.title': 'Who receives new conversations',
  'route.listing': 'The agent of the listing or ad the person came from',
  'route.client': 'Otherwise the agent already assigned to that client',
  'route.queue':
    'Otherwise the Unassigned queue, for the Admin and staff allowed to pick up conversations',
  'blocked.title': 'Blocked numbers and addresses',
  'blocked.body':
    'Their messages are dropped and never appear in the Inbox. Blocked conversations are in the Inbox’s Spam tab, where you can unblock them.',
  'blocked.open': 'Open the Inbox',
  cancel: 'Cancel',
  save: 'Save rules',
  saving: 'Saving…',
  'notice.saved': 'The Inbox rules are saved.',
  'notice.stale':
    'Someone saved the rules meanwhile. The latest rules are shown; make your change again.',
  'notice.failed': 'The rules could not be saved. Your changes are kept; try again.',
};
