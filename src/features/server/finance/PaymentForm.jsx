import React, { useId, useMemo } from 'react';
import { formatAed } from '../../../lib/finance/money.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { FinanceDialog, ReasonField } from './FinanceDialog.jsx';
import { FinanceField as Field } from './FinanceField.jsx';
import { dubaiToday } from './dealEstimate.js';
import { emptyPaymentDraft, entryAmount, paymentDraft, validatePayment } from './entryDraft.js';
import { earnedDealOptions, entryKinds, paymentPreview } from './entryFilters.js';
import { entryFormText, useEntryForm } from './useEntryForm.js';
import { EntryRejection, EntryTextFields, MoneyInput } from './EntryFormParts.jsx';

/**
 * Record or correct a commission receipt (finance-design §4, §7, §16). The deal picker lists
 * only earned deals in the caller's view; the deal is fixed after the payment is created.
 * VAT and total are an estimate; the server computes them and only approval counts them.
 */
export function PaymentForm({ payment, onClose, onDone }) {
  const { overview } = useFinanceContext();
  const id = useId();
  const today = dubaiToday();
  const latest = payment ? overview.payments.find((row) => row.id === payment.id) : null;
  const deals = useMemo(
    () => earnedDealOptions(overview.deals, overview.references),
    [overview.deals, overview.references],
  );
  const form = useEntryForm({
    kind: 'payments',
    latest,
    initial: payment ? paymentDraft(payment) : emptyPaymentDraft(today),
    validate: (draft) => validatePayment(draft, { today, creating: !payment }),
    onDone,
    onClose,
  });
  const { draft, bind, errors } = form;
  const words = entryFormText(entryKinds.payments, latest);
  const chosen = deals.find((option) => option.id === draft.dealId)?.deal ?? null;
  const preview = paymentPreview(entryAmount(draft.amount).value, chosen);
  const noDeals = !payment && !deals.length;
  return (
    <FinanceDialog
      eyebrow={payment ? `COMMISSION RECEIPTS · ${payment.paymentId}` : 'COMMISSION RECEIPTS'}
      title={words.title}
      intro={words.intro}
      busy={form.busy}
      message={form.message}
      onClose={form.requestClose}
      onSubmit={form.submit}
      submitLabel={words.submit}
      submitDisabled={noDeals}
      className="finance-entry-form"
    >
      <EntryRejection entry={latest} />
      {noDeals && (
        <p className="finance-note" role="note">
          Payments can be recorded once the deal is earned. No earned deals are in your view yet.
        </p>
      )}
      <div className="form-grid" ref={form.formRef}>
        {payment ? (
          <Field name="dealId" label="Deal" hint="A payment's deal cannot be changed." wide>
            {(props) => <input {...props} value={payment.dealId} readOnly />}
          </Field>
        ) : (
          <Field
            name="dealId"
            label="Earned deal"
            required
            wide
            error={errors.dealId}
            hint="Only earned deals in your view can receive payments."
          >
            {(props) => (
              <select {...props} {...bind('dealId')} disabled={noDeals} data-initial-focus>
                <option value="">Choose an earned deal</option>
                {deals.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        <Field name="receiptDate" label="Receipt date" required error={errors.receiptDate}>
          {(props) => <input {...props} type="date" max={today} {...bind('receiptDate')} />}
        </Field>
        <Field
          name="amount"
          label="Amount received (AED, excluding VAT)"
          required
          error={errors.amount}
        >
          {(props) => <MoneyInput field={props} bind={bind} />}
        </Field>
        <EntryTextFields
          bind={bind}
          errors={errors}
          fields={[
            ['reference', 'Reference', 'input'],
            ['notes', 'Notes', 'textarea'],
          ]}
        />
        {chosen && (
          <dl className="finance-totals span-all" aria-label="Payment estimate">
            {[
              ['Deal outstanding', chosen.outstandingFils],
              ['VAT (estimate)', preview?.vatFils],
              ['Total with VAT', preview?.totalFils],
            ].map(([label, value]) => (
              <div key={label} className="finance-total">
                <dt>{label}</dt>
                <dd className="finance-money">{formatAed(value)}</dd>
              </div>
            ))}
          </dl>
        )}
        {form.needsReason && (
          <ReasonField
            id={`${id}-reason`}
            label="Reason for changing an approved payment"
            value={form.reason}
            onChange={form.setReason}
            error={errors.reason}
          />
        )}
      </div>
    </FinanceDialog>
  );
}
