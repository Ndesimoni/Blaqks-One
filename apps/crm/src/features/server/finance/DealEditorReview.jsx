import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { formatAed, formatPercent, parseAed, parsePercent } from '../../../lib/finance/money.js';
import { dealSteps, detailFields } from './dealDraft.js';
import { optionLabel } from './dealOptions.js';
import { feeBasisLabels } from './financeLabels.js';

const aed = (text) => formatAed(parseAed(text).value);
const percent = (text) => formatPercent(parsePercent(text).value ?? 0);

/** Review rows per step, formatted from the draft through `money.js` (no floats). */
function rows(form, options) {
  const fixed = form.feeBasis === 'fixed';
  return {
    parties: [
      ['Client', optionLabel(options.clients, form.clientId)],
      ['Property', form.propertyId ? optionLabel(options.properties, form.propertyId) : '—'],
      ['Sale / rental', form.dealType],
    ],
    value: [
      ['Agreed value', aed(form.agreedValue)],
      ['Fee basis', feeBasisLabels[form.feeBasis]],
      fixed ? ['Fixed fee', aed(form.fixedFee)] : ['Fee rate', percent(form.feeRate)],
      ['Partner share', percent(form.partnerShare)],
      ['Partner brokerage', form.partnerName.trim() || '—'],
    ],
    pipeline: [
      ['Deal stage', form.stage],
      ...detailFields
        .filter((field) => String(form.details[field.key] ?? '').trim())
        .map((field) => [field.label, form.details[field.key]]),
    ],
  };
}

/** The editor's Review step with an Edit section shortcut for each step. */
export function DealEditorReview({ form, options, onEdit }) {
  const sections = rows(form, options);
  return (
    <div className="record-review">
      <p className="review-intro">
        Check the deal before saving. Use Edit section to make changes.
      </p>
      {dealSteps
        .filter((step) => sections[step.id])
        .map((step, index) => (
          <section className="review-section" key={step.id} aria-label={step.title}>
            <div className="review-section-heading">
              <h4>{step.title}</h4>
              <Button
                variant="light"
                aria-label={`Edit section: ${step.title}`}
                onClick={() => onEdit(index)}
              >
                Edit section
              </Button>
            </div>
            <dl className="record-review-grid">
              {sections[step.id].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
    </div>
  );
}
