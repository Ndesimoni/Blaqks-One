import React, { useId } from 'react';
import { useI18n } from '../../../../i18n/useI18n.js';
import { purposeOf } from './publishModel.js';

const MARKETS = ['primary', 'resale', ''];

/**
 * The advertising permit (required, confirmed by the publisher, not checked with the
 * authority) and, for sales, the market. No developer field in v1: there is no list yet.
 */
export function PublishDetailsStep({ flow }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`websitePublish.${key}`, vars);
  const id = useId();
  const { draft, change, errors, entry } = flow;
  const error = errors.permit;
  const sale = purposeOf(entry?.record) === 'buy';
  const described = [`${id}-hint`, error ? `${id}-error` : ''].filter(Boolean).join(' ');
  return (
    <>
      <div className="field">
        <label htmlFor={`${id}-permit`}>
          {k('permit')}
          <span className="required"> *</span>
        </label>
        <input
          id={`${id}-permit`}
          type="text"
          autoComplete="off"
          value={draft.permit}
          aria-invalid={Boolean(error)}
          aria-describedby={described}
          onChange={(event) => change({ permit: event.target.value })}
        />
        <small id={`${id}-hint`} className="finance-hint">
          {k('permitHint')}
        </small>
        {error && (
          <p id={`${id}-error`} className="field-error">
            {k(error)}
          </p>
        )}
      </div>
      {sale && (
        <fieldset className="finance-choice website-market">
          <legend>{k('market')}</legend>
          {MARKETS.map((value) => (
            <label key={value || 'none'}>
              <input
                type="radio"
                name={`${id}-market`}
                checked={draft.market === value}
                onChange={() => change({ market: value })}
              />
              <span>{k(`market.${value || 'none'}`)}</span>
            </label>
          ))}
        </fieldset>
      )}
    </>
  );
}
