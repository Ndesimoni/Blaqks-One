import React, { useId } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { AUTHORITIES, EMIRATES, PROPERTY_TYPES } from './joinDraft.js';

/** One checkbox list where the choice is a list of the server's values. */
function ChoiceList({ legend, prefix, values, chosen, onToggle }) {
  const { t } = useI18n();
  return (
    <fieldset className="field span-all market-fieldset">
      <legend>{legend}</legend>
      <div className="market-checks">
        {values.map((value) => (
          <label key={value} className="market-check">
            <input
              type="checkbox"
              checked={chosen.includes(value)}
              onChange={() => onToggle(value)}
            />
            <span>{t(`marketplaceJoin.${prefix}.${value}`)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * The profile fields, shared by joining and editing: emirates, communities, property types,
 * experience and an optional licence.
 */
export function JoinProfileFields({ draft, onChange }) {
  const { t } = useI18n();
  const id = useId();
  const toggle = (key) => (value) =>
    onChange({
      [key]: draft[key].includes(value)
        ? draft[key].filter((item) => item !== value)
        : [...draft[key], value],
    });
  return (
    <div className="form-grid market-form">
      <ChoiceList
        legend={t('marketplaceJoin.join.emirates')}
        prefix="emirate"
        values={EMIRATES}
        chosen={draft.emirates}
        onToggle={toggle('emirates')}
      />
      <ChoiceList
        legend={t('marketplaceJoin.join.propertyTypes')}
        prefix="type"
        values={PROPERTY_TYPES}
        chosen={draft.propertyTypes}
        onToggle={toggle('propertyTypes')}
      />
      <div className="field span-all">
        <label htmlFor={`${id}-communities`}>{t('marketplaceJoin.join.communities')}</label>
        <textarea
          id={`${id}-communities`}
          rows={4}
          value={draft.communities}
          onChange={(event) => onChange({ communities: event.target.value })}
        />
        <small className="finance-hint">{t('marketplaceJoin.join.communitiesHint')}</small>
      </div>
      <div className="field">
        <label htmlFor={`${id}-years`}>{t('marketplaceJoin.join.experience')}</label>
        <input
          id={`${id}-years`}
          type="number"
          min="0"
          max="60"
          value={draft.experienceYears}
          onChange={(event) => onChange({ experienceYears: event.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-licence`}>{t('marketplaceJoin.join.licenceNumber')}</label>
        <input
          id={`${id}-licence`}
          value={draft.licenceNumber}
          maxLength={20}
          onChange={(event) => onChange({ licenceNumber: event.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-authority`}>{t('marketplaceJoin.join.licenceAuthority')}</label>
        <select
          id={`${id}-authority`}
          value={draft.licenceAuthority}
          onChange={(event) => onChange({ licenceAuthority: event.target.value })}
        >
          {AUTHORITIES.map((authority) => (
            <option key={authority} value={authority}>
              {t(`marketplaceJoin.authority.${authority}`)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
