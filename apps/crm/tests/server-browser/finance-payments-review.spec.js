import { test, expect } from './fixtures.js';
import {
  approvalTeam,
  decided,
  entryRow,
  giveReason,
  memberPage,
  openEntries,
  openEntry,
  paymentBody,
  submit,
} from './finance-payments-fixtures.js';

const SELF = 'Another approver must review your own submissions.';

test('approvers never review their own submissions; a rejected payment is corrected and resubmitted', async ({
  browser,
}) => {
  const team = await approvalTeam('fin-ui-review');
  const { admin, agent, approver } = team;
  const body = (amountFils) => paymentBody(team.deal.dealId, { amountFils });
  const mine = await submit(approver, admin, 'payments', body(200_000));
  const theirs = await submit(agent, admin, 'payments', body(300_000));

  const review = await memberPage(browser, team.people.approver.email);
  await openEntries(review.page, 'payments', { queue: true });
  const ownRow = entryRow(review.page, 'payments', mine.paymentId);
  await expect(ownRow).toContainText(SELF);
  await expect(ownRow.getByRole('button', { name: /^(Approve|Reject)/ })).toHaveCount(0);
  const details = await openEntry(review.page, mine.paymentId);
  await expect(details.getByRole('note').filter({ hasText: SELF })).toBeVisible();
  await details.getByRole('button', { name: `Close ${mine.paymentId} details` }).click();

  await entryRow(review.page, 'payments', theirs.paymentId)
    .getByRole('button', { name: `Reject ${theirs.paymentId}` })
    .click();
  const reject = review.page.getByRole('dialog', { name: 'Reject payment' });
  await expect(reject.getByRole('button', { name: 'Reject', exact: true })).toBeDisabled();
  await giveReason(review.page, 'Reject payment', 'Bank slip missing', 'Reject');
  await review.page.getByRole('button', { name: /Awaiting approval/ }).click();
  const rejected = entryRow(review.page, 'payments', theirs.paymentId);
  await expect(rejected).toContainText('Rejected');
  await expect(rejected).toContainText('Bank slip missing');

  const own = await memberPage(browser, team.people.agent.email);
  await openEntries(own.page, 'payments');
  const view = await openEntry(own.page, theirs.paymentId);
  await expect(view.getByRole('note')).toContainText('Rejected: Bank slip missing');
  await view.getByRole('button', { name: 'Correct and resubmit' }).click();
  const form = own.page.getByRole('dialog', { name: 'Correct and resubmit' });
  await expect(form.getByRole('note')).toContainText('Bank slip missing');
  await expect(form.getByLabel('Deal', { exact: true })).toHaveValue(team.deal.dealId);
  await form.getByLabel('Amount received').fill('3,500');
  await form.getByRole('button', { name: 'Resubmit', exact: true }).click();
  await expect(form).toHaveCount(0);
  await expect(view.getByText('Pending approval', { exact: true })).toBeVisible();
  await view.getByRole('button', { name: 'Show history' }).click();
  const history = view.getByRole('listitem');
  await expect(history.filter({ hasText: 'Rejected' })).toContainText('Reason: Bank slip missing');
  await expect(history.filter({ hasText: 'Corrected and resubmitted' })).toHaveCount(1);
  await expect(view.getByText(/Amount:/)).toHaveCount(0);
  await own.context.close();

  // A fresh load, off the queue, shows the resubmitted row's latest version.
  await review.page.goto('/#/payments');
  await review.page.reload();
  await openEntries(review.page, 'payments');
  const again = entryRow(review.page, 'payments', theirs.paymentId);
  await again.getByRole('button', { name: `Approve ${theirs.paymentId}` }).click();
  await expect(again).toContainText('Approved');
  await review.context.close();
});

test('the Admin edits approved payments only with a reason and voids them with a reason', async ({
  browser,
}) => {
  const team = await approvalTeam('fin-ui-void');
  const { admin, agent, approver } = team;
  const payment = await decided(
    approver,
    admin,
    'payments',
    await submit(agent, admin, 'payments', paymentBody(team.deal.dealId, { amountFils: 400_000 })),
    'approve',
  );
  const { page, context } = await memberPage(browser, team.people.admin.email);
  await openEntries(page, 'payments');
  const details = await openEntry(page, payment.paymentId);
  await expect(details).toContainText(team.people.approver.name);
  await details.getByRole('button', { name: 'Edit approved record' }).click();
  const form = page.getByRole('dialog', { name: 'Edit approved payment' });
  await form.getByLabel('Reference').fill('INV-9');
  await form.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(form.getByText('A reason of 1 to 500 characters is required.')).toBeVisible();
  await form.getByLabel(/Reason for changing/).fill('Reference typo');
  await form.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(form).toHaveCount(0);
  await expect(details).toContainText('INV-9');

  await details.getByRole('button', { name: `Void ${payment.paymentId}` }).click();
  await giveReason(page, 'Void payment', 'Duplicate receipt', 'Void');
  await expect(details.getByRole('note')).toContainText('Voided: Duplicate receipt');
  await expect(details.getByRole('button', { name: /^(Void|Edit)/ })).toHaveCount(0);
  await details.getByRole('button', { name: 'Show history' }).click();
  const voided = details.getByRole('listitem').filter({ hasText: /^Voided/ });
  await expect(voided).toContainText('Reason: Duplicate receipt');
  await details.getByRole('button', { name: `Close ${payment.paymentId} details` }).click();
  await expect(entryRow(page, 'payments', payment.paymentId)).toContainText('Voided');
  await context.close();
});
