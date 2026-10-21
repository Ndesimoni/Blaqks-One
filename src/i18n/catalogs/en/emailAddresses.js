/** Sending addresses on the company's SendGrid domain, in English (docs/i18n.md). */
export default {
  title: 'Sending addresses',
  intro:
    'Each member who may email clients sends from one address on {domain}. Members never choose their own From address.',
  introPending: 'Addresses appear once SendGrid is connected.',
  loading: 'Loading sending addresses…',
  loadError: 'The sending addresses could not be loaded.',
  empty: 'No sending addresses yet. Add one for each member who emails clients.',
  noneEligible:
    'Every member who may email clients already has an address. To add someone, give them Email access in Team & access first.',
  add: 'Add address',
  addTitle: 'Add a sending address',
  member: 'Team member',
  chooseMember: 'Choose a member',
  memberRequired: 'Choose the member who will use this address.',
  localPart: 'Address',
  localHint: 'Lower-case letters, numbers, dots, dashes or underscores, such as aidah.',
  preview: 'Full address: {address}',
  localInvalid:
    'Use 1 to 64 lower-case letters, numbers, dots, dashes or underscores, starting and ending with a letter or number.',
  localRole:
    "This address is kept for the company's mail system. Choose another, such as the person's name.",
  displayName: 'Name clients see',
  nameHint: 'Up to 80 characters, without @, quotes or angle brackets.',
  nameInvalid:
    'Use 1 to 80 characters for the name, without @, quotes, angle brackets or line breaks.',
  addAction: 'Save address',
  active: 'Active',
  reserved: 'Kept for a former member',
  formerMember: 'a former member',
  shownAs: 'Clients see “{name}” · Belongs to {member}',
  reservedHint: 'Mail to this address goes to Unassigned. It can only return to the same person.',
  rename: 'Rename',
  renameFor: 'Rename {address}',
  saveName: 'Save name',
  reserve: 'Keep for former member',
  reserveFor: 'Keep {address} for a former member',
  reserveTitle: 'Keep {address} for a former member?',
  reserveBody:
    'It stops sending at once and mail to it goes to Unassigned. It can never be given to anyone else, only back to {member}.',
  addedNotice: '{address} is ready to send.',
  renamedNotice: 'The name for {address} is saved.',
  reservedNotice: '{address} is kept for a former member.',
  failed: 'The change could not be saved. Try again.',
};
