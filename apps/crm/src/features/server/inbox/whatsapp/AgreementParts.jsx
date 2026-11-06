import React, { useEffect, useRef } from 'react';
import { Button } from '../../../../components/ui/Button.jsx';
import { useI18n } from '../../../../i18n/useI18n.js';
import { REASON_LIMIT, SOURCES } from './whatsappModel.js';

/** By phone, in person or on a form: native radios shown as chips (WQ2). */
export function SourceChoice({ id, value, first, problem, onChange }) {
  const { t } = useI18n();
  const invalid = problem === 'agreement.chooseSource';
  return (
    <fieldset
      className="wa-sources"
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={invalid ? `${id}-source-error` : undefined}
    >
      <legend>{t('whatsappSend.agreement.how')}</legend>
      <div className="wa-source-chips">
        {SOURCES.map((source, index) => (
          <label key={source} className={'wa-source' + (value === source ? ' is-chosen' : '')}>
            <input
              ref={index === 0 ? first : undefined}
              type="radio"
              name={`${id}-source`}
              value={source}
              checked={value === source}
              onChange={() => onChange(source)}
            />
            <span>{t(`whatsappSend.agreement.source_${source}`)}</span>
          </label>
        ))}
      </div>
      {invalid && (
        <p id={`${id}-source-error`} className="field-error">
          {t('whatsappSend.agreement.chooseSource')}
        </p>
      )}
    </fieldset>
  );
}

/** The Admin's written reason for restoring agreement after a STOP (1–500 characters). */
export function RestoreField({ id, value, field, problem, onChange }) {
  const { t } = useI18n();
  const invalid = problem === 'agreement.restoreNeeded';
  return (
    <div className="wa-field field">
      <label htmlFor={`${id}-reason`}>{t('whatsappSend.agreement.restoreReason')}</label>
      <textarea
        id={`${id}-reason`}
        ref={field}
        rows={2}
        maxLength={REASON_LIMIT}
        value={value}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={`${id}-reason-hint${invalid ? ` ${id}-reason-error` : ''}`}
        onChange={(event) => onChange(event.target.value)}
      />
      <small id={`${id}-reason-hint`} className="wa-hint">
        {t('whatsappSend.agreement.restoreHint')}
      </small>
      {invalid && (
        <p id={`${id}-reason-error`} className="field-error">
          {t('whatsappSend.agreement.restoreNeeded')}
        </p>
      )}
    </div>
  );
}

/**
 * Confirms STOP before it is recorded; Cancel takes focus. Escape cancels here without
 * closing a surrounding dialog.
 */
export function StopConfirm({ busy, onConfirm, onCancel }) {
  const { t } = useI18n();
  const group = useRef(null);
  useEffect(() => group.current?.querySelector('[data-cancel]')?.focus(), []);
  return (
    <div
      ref={group}
      className="wa-confirm"
      role="group"
      aria-label={t('whatsappSend.agreement.stop')}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || busy) return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
    >
      <strong>{t('whatsappSend.agreement.stopTitle')}</strong>
      <span>{t('whatsappSend.agreement.stopBody')}</span>
      <div>
        <Button variant="danger-light" disabled={busy} onClick={onConfirm}>
          {t('whatsappSend.agreement.stop')}
        </Button>
        <Button variant="light" data-cancel disabled={busy} onClick={onCancel}>
          {t('whatsappSend.agreement.cancel')}
        </Button>
      </div>
    </div>
  );
}
