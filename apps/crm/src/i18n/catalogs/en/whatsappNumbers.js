/** Members' WhatsApp numbers on Channels, in English. Keys are `whatsappNumbers.<key>`. */
export default {
  title: "Members' numbers",
  intro:
    "Give each member with WhatsApp access their own number from the company's Twilio account. Members see theirs under My WhatsApp.",
  give: 'Give a number',
  loading: 'Loading numbers…',
  loadError: 'The numbers could not be loaded.',
  empty: 'No numbers given yet.',
  emptyHint: 'Each member holds one number, chosen from the WhatsApp senders in Twilio.',
  formerMember: 'Former member',
  you: '{name} (you)',
  since: 'Connected {date}',
  disconnect: 'Disconnect',
  disconnectFor: 'Disconnect {phone}',
  disconnectTitle: 'Disconnect {phone} from {member}?',
  disconnectBody:
    '{member} stops receiving WhatsApp messages on this number in the CRM. Past conversations stay, and you can give the number again later.',
  disconnectConfirm: 'Disconnect number',
  disconnected: '{phone} is disconnected.',
  given: '{phone} is now the WhatsApp number of {member}.',
  failed: 'The change could not be saved. Try again.',
  'dialog.eyebrow': 'WhatsApp',
  'dialog.title': 'Give a number',
  'dialog.intro':
    'Choose a member, then one of the numbers registered as a WhatsApp sender in your Twilio account.',
  'dialog.member': 'Team member',
  'dialog.chooseMember': 'Choose a member',
  'dialog.memberHint': 'Members with WhatsApp access who have no number yet.',
  'dialog.sender': 'WhatsApp number',
  'dialog.chooseSender': 'Choose a number',
  'dialog.senderHint': 'Online WhatsApp senders that no one has yet.',
  'dialog.unavailable': {
    one: '{count} other sender in Twilio is offline or already connected.',
    other: '{count} other senders in Twilio are offline or already connected.',
  },
  'dialog.memberRequired': 'Choose a team member.',
  'dialog.senderRequired': 'Choose a WhatsApp number.',
  'dialog.submit': 'Give number',
  'dialog.close': 'Close',
  'dialog.loading': 'Checking the WhatsApp senders in Twilio…',
  'dialog.loadError': 'The WhatsApp senders could not be read from Twilio.',
  'dialog.retry': 'Try again',
  'dialog.noMembers':
    'Everyone who may use WhatsApp already has a number. Turn on WhatsApp for a member in Team & access, or disconnect a number first.',
  'dialog.noSendersTitle': 'No number is free to give',
  'dialog.noSenders':
    'Register the number as a WhatsApp sender in Twilio first (Messaging → Senders → WhatsApp senders) and wait until it shows as online, then open this again.',
};
