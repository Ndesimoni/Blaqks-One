import React, { useId } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { SOURCES, STAGES } from './clientsModel.js';

/**
 * The client form's fields in one card, as the CRM's form slider: names, how to reach them,
 * where they came from, the stage, the next follow-up, who works on them and notes. Required
 * fields carry the star the header explains.
 */
export function ClientFormFields({ form, owners, busy, onField }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`platformClients.${key}`, vars);
  const id = useId();
  const label = (key, required = false) => (
    <label htmlFor={`${id}-${key}`}>
      {k(`field.${key}`)}
      {required && <span className="required"> *</span>}
    </label>
  );
  const input = (key, type = 'text', props = {}) => (
    <input
      id={`${id}-${key}`}
      type={type}
      value={form[key]}
      disabled={busy}
      onChange={(event) => onField(key, event.target.value)}
      {...props}
    />
  );
  const select = (key, options) => (
    <select
      id={`${id}-${key}`}
      value={form[key]}
      disabled={busy}
      onChange={(event) => onField(key, event.target.value)}
    >
      {options.map(([value, text]) => (
        <option key={value} value={value}>
          {text}
        </option>
      ))}
    </select>
  );
  return (
    <div className="form-card">
      <h3 className="form-step-title">{k('formSection')}</h3>
      <div className="form-grid">
        <div className="field">
          {label('companyName')}
          {input('companyName', 'text', { autoComplete: 'organization', maxLength: 160 })}
          <small>{k('namesHint')}</small>
        </div>
        <div className="field">
          {label('contactName')}
          {input('contactName', 'text', { autoComplete: 'name', maxLength: 120 })}
        </div>
        <div className="field">
          {label('phone')}
          {input('phone', 'tel', { autoComplete: 'tel', maxLength: 32 })}
          <small>{k('phoneHint')}</small>
        </div>
        <div className="field">
          {label('email')}
          {input('email', 'email', { autoComplete: 'email', maxLength: 254 })}
          <small>{k('reachHint')}</small>
        </div>
        <div className="field">
          {label('source', true)}
          {select(
            'source',
            SOURCES.map((value) => [value, k(`source.${value}`)]),
          )}
        </div>
        <div className="field">
          {label('stage', true)}
          {select(
            'stage',
            STAGES.map((value) => [value, k(`stage.${value}`)]),
          )}
        </div>
        <div className="field">
          {label('nextFollowUp')}
          {input('nextFollowUp', 'date')}
        </div>
        <div className="field">
          {label('ownerId')}
          {select('ownerId', [
            ['', k('nobody')],
            ...owners.map((person) => [person.id, person.name]),
          ])}
        </div>
        <div className="field span-all">
          {label('notes')}
          <textarea
            id={`${id}-notes`}
            rows={4}
            maxLength={4000}
            value={form.notes}
            disabled={busy}
            onChange={(event) => onField('notes', event.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
