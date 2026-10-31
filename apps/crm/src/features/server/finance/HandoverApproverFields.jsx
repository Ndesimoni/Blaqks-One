import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';

/**
 * "Needs approval" for a staff-to-staff hand-over (agreements design §17, owner decision 4):
 * the tick reveals the approver, chosen from `GET /finance/approvers` without the receiver.
 * The receiver accepts first; then the approver approves and only then does the deal move.
 * The server checks every choice again.
 */
export function HandoverApproverFields({ id, needed, onNeeded, approvers, value, onChange }) {
  const { t } = useI18n();
  const k = (key) => t(`handoverRequests.form.${key}`);
  const { people, loading, error } = approvers;
  return (
    <>
      {/* A group, like the radio cards, so the card keeps its height when the body scrolls. */}
      <div className="deal-options">
        <label className="deal-option" data-checked={needed}>
          <input
            type="checkbox"
            checked={needed}
            onChange={(event) => onNeeded(event.target.checked)}
          />
          <span className="deal-option-text">
            <span className="deal-option-title">{k('needsApproval')}</span>
            <small>{k('needsApprovalDetail')}</small>
          </span>
        </label>
      </div>
      {needed && (
        <div className="field">
          <label htmlFor={`${id}-approver`}>
            {k('approver')}
            <span className="required"> *</span>
          </label>
          <select
            id={`${id}-approver`}
            value={value}
            disabled={loading}
            aria-describedby={`${id}-approver-hint`}
            onChange={(event) => onChange(event.target.value)}
          >
            <option value="">{loading ? k('approverLoading') : k('approverChoose')}</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <small id={`${id}-approver-hint`} className="finance-hint">
            {k('approverHint')}
          </small>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          {!loading && !error && !people.length && (
            <p className="field-error" role="alert">
              {k('approverNone')}
            </p>
          )}
        </div>
      )}
    </>
  );
}
