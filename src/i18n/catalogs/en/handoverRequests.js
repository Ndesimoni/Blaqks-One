/**
 * Open deal hand-over requests, the hand-over form's Admin and approval choices, and the
 * sidebar badges (agreements design §17), in Deals.
 */
export default {
  title: 'Hand-over requests',
  count: { one: '{count} open request', other: '{count} open requests' },
  offersYou: '{from} offers you this deal',
  waitingResponse: 'Waiting for {name} to respond',
  waitingApproval: 'Waiting for {name} to approve',
  yourApproval: '{to} accepted the offer from {from}. Waiting for your approval.',
  between: '{from} → {to}',
  betweenWaiting: '{from} → {to}. Waiting for {name} to approve.',
  earned: 'Earned',
  full: 'Full hand-over',
  referral: 'Referral share',
  toAdmin: 'To the Admin',
  keeps: '{name} keeps a {share} referral share',
  needsApproval: 'Needs approval by {name}',
  endsAt: 'Offer ends {date}',
  group: 'Hand-over of {dealId}',
  review: 'Review offer',
  reviewLabel: 'Review offer for hand-over of {dealId}',
  reviewApproval: 'Review',
  reviewApprovalLabel: 'Review hand-over of {dealId} for approval',
  decline: 'Decline',
  declineLabel: 'Decline hand-over of {dealId}',
  cancel: 'Cancel request',
  cancelLabel: 'Cancel request hand-over of {dealId}',
  approve: 'Approve',
  approveLabel: 'Approve hand-over of {dealId}',
  'form.adminOption': '{name} (Admin)',
  'form.adminFull': 'A deal offered to the Admin is handed over fully.',
  'form.needsApproval': 'Needs approval',
  'form.needsApprovalDetail': 'Someone approves after your teammate accepts.',
  'form.approver': 'Approver',
  'form.approverChoose': 'Choose an approver',
  'form.approverLoading': 'Loading approvers…',
  'form.approverNone':
    'Nobody else can approve yet. Your Admin gives the Finance Approve right in Team.',
  'form.approverHint':
    'The receiver accepts first, then the approver approves. Only then does the deal move.',
  'form.outcome': 'After {name} accepts, they hold the deal.',
  'form.outcomeApproval': 'After {name} accepts and {approver} approves, {name} holds the deal.',
  'form.outcomeAdmin':
    'After {name} accepts, the company holds the deal and no agent commission is earned.',
  'form.leavesList': 'It then leaves your list.',
  'form.referralNote': 'Your referral share appears in your commission statement once earned.',
  'nav.deals': {
    one: '{count} hand-over waiting for you',
    other: '{count} hand-overs waiting for you',
  },
  'nav.agreements': {
    one: '{count} offer or listing waiting for your answer',
    other: '{count} offers or listings waiting for your answer',
  },
};
