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
  'auto.sources': 'They come from one of our ads, listings, lead forms or portals',
  'auto.sourcesHint': 'Click-to-chat ads, listing links, lead forms and property portal enquiries.',
  'words.title': 'Property words',
  'words.hint':
    'A first message matches when at least two of these words appear, in English or Arabic.',
  'words.list': 'Property words',
  'words.remove': 'Remove {word}',
  'words.add': 'Add word',
  'words.placeholder': 'Add a word',
  'mode.title': 'New senders by email and social messages',
  'mode.body':
    'A first message from an unknown sender matches when it has at least two property words. One word does nothing.',
  'mode.label': 'What property words do',
  'mode.suggest': 'Suggest a lead',
  'mode.suggestHint': 'A person checks it in the Client inbox first. Recommended.',
  'mode.create': 'Create the lead straight away',
  'mode.createHint': 'Faster, but some spam may become leads.',
  'sources.title': 'Lead sources',
  'sources.body': 'Messages from these sources always create a lead.',
  'route.title': 'Who receives new conversations',
  'route.listing': 'The agent of the listing or ad the person came from',
  'route.client': 'Otherwise the agent already assigned to that client',
  'route.queue':
    'Otherwise the Unassigned queue, for the Admin and staff allowed to pick up conversations',
  'blocked.title': 'Blocked senders',
  'blocked.body':
    'Messages from blocked senders in company conversations are dropped and never shown. Block a sender from their conversation in the Client inbox.',
  'blocked.none': 'No blocked senders.',
  'blocked.unblock': 'Unblock',
  'blocked.unblockNamed': 'Unblock {name}',
  cancel: 'Discard changes',
  save: 'Save rules',
  unsaved: 'You have unsaved changes.',
  version: 'Version {version}',
  defaults: 'The usual rules are in use until you save your own.',
  saving: 'Saving…',
  'notice.saved': 'The Inbox rules are saved.',
  'notice.stale':
    'Someone saved the rules meanwhile. The latest rules are shown; make your change again.',
  'notice.failed': 'The rules could not be saved. Your changes are kept; try again.',
};
