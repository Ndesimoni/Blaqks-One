import React from 'react';
import { FinanceField as Field } from './FinanceField.jsx';
import { detailFields } from './dealDraft.js';
import { dealStages, dealTypes } from './dealModel.js';
import { feeBasisLabels } from './financeLabels.js';

const choices = (values, labels = {}) =>
  values.map((value) => (
    <option key={value.id ?? value} value={value.id ?? value}>
      {value.label ?? labels[value] ?? value}
    </option>
  ));

/** The current step's fields: Parties, Value & fee, or Pipeline (finance-design §7). */
export function DealEditorFields({ stepId, state, options, labelledBy }) {
  const { form, errors, change, changeDetail } = state;
  const bind = (key) => ({
    value: form[key],
    onChange: (event) => change(key, event.target.value),
  });
  const text = (key, label, extra = {}) => (
    <Field name={key} label={label} error={errors[key]} {...extra}>
      {(props) => <input {...props} {...bind(key)} inputMode="decimal" autoComplete="off" />}
    </Field>
  );
  return (
    <section className="form-section" aria-labelledby={labelledBy}>
      <div className="form-grid">
        {stepId === 'parties' && (
          <>
            <Field
              name="clientId"
              label="Client"
              required
              error={errors.clientId}
              hint={options.clients.length ? null : 'No clients are available for you to link.'}
            >
              {(props) => (
                <select {...props} {...bind('clientId')} data-initial-focus>
                  <option value="">Choose a client</option>
                  {choices(options.clients)}
                </select>
              )}
            </Field>
            <Field name="propertyId" label="Property">
              {(props) => (
                <select {...props} {...bind('propertyId')}>
                  <option value="">No linked property</option>
                  {choices(options.properties)}
                </select>
              )}
            </Field>
            <Field name="dealType" label="Sale / rental" required error={errors.dealType}>
              {(props) => (
                <select {...props} {...bind('dealType')}>
                  {choices(dealTypes)}
                </select>
              )}
            </Field>
          </>
        )}
        {stepId === 'value' && (
          <>
            {text('agreedValue', 'Agreed value AED', {
              required: true,
              hintKey: 'fieldHints.deals.agreedValue',
            })}
            <Field name="feeBasis" label="Fee basis" required hintKey="fieldHints.deals.feeBasis">
              {(props) => (
                <select {...props} {...bind('feeBasis')}>
                  {choices(['percentage', 'fixed'], feeBasisLabels)}
                </select>
              )}
            </Field>
            {form.feeBasis === 'fixed'
              ? text('fixedFee', 'Fixed fee AED (ex VAT)', {
                  required: true,
                  hintKey: 'fieldHints.deals.fixedFee',
                })
              : text('feeRate', 'Fee rate %', {
                  required: true,
                  hintKey: 'fieldHints.deals.feeRate',
                })}
            {text('partnerShare', 'Partner share %', {
              hintKey: 'fieldHints.deals.partnerShare',
            })}
            <Field name="partnerName" label="Partner brokerage">
              {(props) => <input {...props} {...bind('partnerName')} maxLength={200} />}
            </Field>
          </>
        )}
        {stepId === 'pipeline' && (
          <>
            <Field name="stage" label="Deal stage" required error={errors.stage}>
              {(props) => (
                <select {...props} {...bind('stage')}>
                  {choices(dealStages)}
                </select>
              )}
            </Field>
            {detailFields.map((field) => (
              <Field
                key={field.key}
                name={field.key}
                label={field.label}
                wide={field.type === 'textarea'}
              >
                {(props) => {
                  const Control = field.type === 'textarea' ? 'textarea' : 'input';
                  return (
                    <Control
                      {...props}
                      type={field.type === 'textarea' ? undefined : field.type}
                      rows={field.type === 'textarea' ? 4 : undefined}
                      maxLength={4000}
                      value={form.details[field.key] ?? ''}
                      onChange={(event) => changeDetail(field.key, event.target.value)}
                    />
                  );
                }}
              </Field>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
