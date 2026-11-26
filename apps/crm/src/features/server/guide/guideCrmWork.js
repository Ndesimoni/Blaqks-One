/** Guide articles for viewings, deals, money and client care in the CRM (design queue item 13). */
export const crmWorkGuides = [
  {
    id: 'viewings',
    topic: 'CRM',
    section: 'Viewings',
    title: 'Arranging viewings and recording how they went',
    path: ['CRM', 'Activities', 'Viewings'],
    intro: 'Book each viewing against a client and a property, then record how it went.',
    steps: [
      'Choose Create in the top bar, then Viewing.',
      'Pick the client and the property, and set the appointment date and time.',
      'Check the week in Activities → Viewings, in the Week or List view.',
      'After the viewing, open it to set its status and the next action.',
    ],
  },
  {
    id: 'deals',
    topic: 'CRM',
    section: 'Deals',
    title: 'Moving a deal to completion',
    path: ['CRM', 'Deals & money', 'Deals'],
    intro: 'A deal follows a sale or rental from viewing to completion, with its commission.',
    steps: [
      'Open Deals and choose Add deal.',
      'Open the deal to see its stage bar, its facts and the commission split.',
      'Choose Move to the next stage as it progresses.',
      'Choose Record payment when a fee arrives. It counts once it is approved.',
    ],
  },
  {
    id: 'money',
    topic: 'CRM',
    section: 'Payments',
    title: 'Recording fee receipts and expenses',
    path: ['CRM', 'Deals & money', 'Payments'],
    intro: 'Fee receipts and expenses count only once they are approved.',
    steps: [
      'Open Payments or Expenses and add the record.',
      'Submit it for approval.',
      'An Admin, or a member the Admin trusts with approvals, approves it or sends it back. Staff approvers never decide their own work.',
      'Approved records count in the deal and in the commission statement.',
    ],
  },
  {
    id: 'client-care',
    topic: 'CRM',
    section: 'Client care',
    title: 'Keeping in touch after a deal',
    path: ['CRM', 'Activities', 'Client care'],
    intro: 'Client care plans renewals, referrals and check-ins with past clients.',
    steps: [
      'Open Activities → Client care.',
      'Choose Create, then Client care entry, and pick the client.',
      'Choose the touchpoint type and set the next contact date.',
      'Log each conversation in the Interaction log, so the history stays with the client.',
    ],
  },
];
