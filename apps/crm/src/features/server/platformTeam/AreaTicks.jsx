import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { AREA_LEVELS, PLATFORM_AREAS } from '../platformAccess.js';

/**
 * Each area at Off, View or Manage (owner, 2026-11-05), like the old view and edit ticks:
 * View reads, Manage also changes. Areas offer only the levels they have.
 */
export function AreaTicks({ access, onLevel, disabled }) {
  const { t } = useI18n();
  const k = (key) => t(`platformTeam.${key}`);
  return (
    <fieldset className="platform-areas" disabled={disabled}>
      <legend>{k('areas')}</legend>
      {PLATFORM_AREAS.map((area) => (
        <div key={area} className="platform-area" role="radiogroup" aria-label={k(`area.${area}`)}>
          <span>
            <strong>{k(`area.${area}`)}</strong>
            <small>{k(`hint.${area}`)}</small>
          </span>
          <span className="platform-levels">
            {['off', ...AREA_LEVELS[area]].map((level) => (
              <label key={level}>
                <input
                  type="radio"
                  name={`level-${area}`}
                  value={level}
                  checked={(access[area] || 'off') === level}
                  onChange={() => onLevel(area, level)}
                />
                {k(`level.${level}`)}
              </label>
            ))}
          </span>
        </div>
      ))}
    </fieldset>
  );
}
