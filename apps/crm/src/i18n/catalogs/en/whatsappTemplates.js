/** WhatsApp templates on Channels in English (W1b). Keys are `whatsappTemplates.<key>`. */
export default {
  title: 'Message templates',
  intro:
    'Approved templates from your Twilio account. Members send one when the client’s last message is more than 24 hours old.',
  refresh: 'Refresh',
  refreshing: 'Refreshing…',
  refreshed: 'Templates read from Twilio.',
  loading: 'Loading templates…',
  loadError: 'The templates could not be loaded.',
  synced: 'Read from Twilio {date}',
  never: 'Not read from Twilio yet.',
  syncFailed: 'The last read from Twilio failed {date}. The list shows what was read before.',
  empty: 'No templates yet.',
  emptyHint:
    'Write templates in Twilio’s Content Template Builder, where Meta approves them. Then press Refresh.',
  'approval.approved': 'Approved',
  'approval.pending': 'Waiting for approval',
  'approval.rejected': 'Rejected',
  'approval.paused': 'Paused',
  'approval.disabled': 'Disabled',
  'approval.other': 'Not approved',
  offered: 'Offered to members',
  notOffered: 'Not offered until approved',
  notText: 'Not offered: only text templates are sent from the CRM',
  variables: { one: '{count} value to fill in', other: '{count} values to fill in' },
  noVariables: 'No values to fill in',
};
