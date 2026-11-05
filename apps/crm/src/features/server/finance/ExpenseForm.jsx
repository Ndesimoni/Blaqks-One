import React, { useId, useMemo } from 'react';
import { useRecords } from '../../../hooks/useWorkspace.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { FinanceDialog, ReasonField } from './FinanceDialog.jsx';
import { FinanceField as Field } from './FinanceField.jsx';
import { dubaiToday } from './dealEstimate.js';
import { propertyOptions } from './dealOptions.js';
import { emptyExpenseDraft, expenseDraft, validateExpense } from './expenseDraft.js';
import { entryKinds } from './entryFilters.js';
import { entryFormText, useEntryForm } from './useEntryForm.js';
import { EntryRejection, EntryTextFields, MoneyInput } from './EntryFormParts.jsx';

/** Owner choices besides the Admin: active team members with finance, plus the current one. */
function ownerOptions(people, me, current) {
  const options = people.filter((person) => person.id !== me.id);
  if (current && current.id !== me.id && !options.some((person) => person.id === current.id))
    options.push(current);
  return options;
}

/**
 * Record or correct a business expense (finance-design §4, §7, §16). Staff always record for
 * themselves; the Admin may record on behalf of a team member. Receipt links are https only
 * and are never opened or fetched by the CRM.
 */
export function ExpenseForm({ expense, onClose, onDone }) {
  const { overview, access, assignees, user } = useFinanceContext();
  const { entries } = useRecords();
  const id = useId();
  const today = dubaiToday();
  const latest = expense ? overview.expenses.find((row) => row.id === expense.id) : null;
  const properties = useMemo(
    () => propertyOptions(entries, expense?.propertyId ?? ''),
    [entries, expense],
  );
  const form = useEntryForm({
    kind: 'expenses',
    latest,
    initial: expense ? expenseDraft(expense) : emptyExpenseDraft(today),
    validate: (draft) => validateExpense(draft, { today, manage: access.manage }),
    onDone,
    onClose,
  });
  const { bind, errors } = form;
  const words = entryFormText(entryKinds.expenses, latest);
  const owners = ownerOptions(assignees.people, user, expense?.incurredBy);
  return (
    <FinanceDialog
      eyebrow={expense ? `BUSINESS EXPENSES · ${expense.expenseId}` : 'BUSINESS EXPENSES'}
      title={words.title}
      intro={words.intro}
      busy={form.busy}
      message={form.message}
      onClose={form.requestClose}
      onSubmit={form.submit}
      submitLabel={words.submit}
      className="finance-entry-form"
    >
      <EntryRejection entry={latest} />
      <div className="form-grid" ref={form.formRef}>
        {access.manage ? (
          <Field
            name="incurredBy"
            label="Incurred by"
            error={errors.incurredBy}
            hint={assignees.error || 'Record it for yourself or for a team member with finance.'}
            wide
          >
            {(props) => (
              <select {...props} {...bind('incurredBy')} data-initial-focus>
                <option value={expense ? user.id : ''}>For myself ({user.name})</option>
                {owners.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        ) : (
          <p className="finance-hint span-all">
            {expense ? `Incurred by ${expense.incurredBy.name}.` : 'Recorded for yourself.'}
          </p>
        )}
        <Field name="datePaid" label="Date paid" required error={errors.datePaid}>
          {(props) => <input {...props} type="date" max={today} {...bind('datePaid')} />}
        </Field>
        <Field name="amount" label="Amount (AED)" required error={errors.amount}>
          {(props) => <MoneyInput field={props} bind={bind} />}
        </Field>
        <EntryTextFields
          bind={bind}
          errors={errors}
          fields={[
            ['category', 'Category', 'input'],
            ['supplier', 'Supplier', 'input'],
            ['campaignReference', 'Campaign reference', 'input'],
          ]}
        />
        <Field name="propertyId" label="Property" error={errors.propertyId}>
          {(props) => (
            <select {...props} {...bind('propertyId')}>
              <option value="">No linked property</option>
              {properties.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <EntryTextFields
          bind={bind}
          errors={errors}
          fields={[
            ['receiptUrl', 'Receipt link', 'url', 'https:// links only. The CRM never opens it.'],
            ['notes', 'Notes', 'textarea'],
          ]}
        />
        {form.needsReason && (
          <ReasonField
            id={`${id}-reason`}
            label="Reason for changing an approved expense"
            value={form.reason}
            onChange={form.setReason}
            error={errors.reason}
          />
        )}
      </div>
    </FinanceDialog>
  );
}
