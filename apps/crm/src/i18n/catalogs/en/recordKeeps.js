/**
 * Handed-over clients and listings a member keeps reading (agreements design §18), and the
 * view-only copies a colleague shared (record sharing R1).
 */
export default {
  viewOnly: 'View only.',
  handedOver: 'Handed over to {name} on {date} · deal {dealId} · {share}.',
  shared:
    'Shared with you by {name} on {date} for deal {dealId} · {share}. {name} keeps this listing.',
  colleague: 'Shared with you by {name} on {date}.',
  full: 'full hand-over',
  referral: 'referral {share}',
  chip: 'View only',
  chipHanded: 'Handed over to {name}. Open it to see when and for which deal.',
  chipShared: 'Shared with you by {name}, who keeps this listing.',
  chipColleague: 'Shared with you by {name}. Open it to see when.',
  refused: 'This record was handed over. You can view it but not change it.',
  refusedColleague: 'This record was shared with you. You can view it but not change it.',
};
