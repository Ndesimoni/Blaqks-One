import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';

const READY = ['ready', 'off_plan', 'any'];
const FURNISHING = ['furnished', 'unfurnished', 'part_furnished', 'any'];
const AGES = ['new', 'under_5', '5_to_10', 'over_10', 'any'];
const CHEQUES = [1, 2, 3, 4, 6, 12];

/** The preferences and areas of a request, below its main facts (packet MK2). */
export function MarketplaceRequestPreferenceFields({ draft, onChange, prefix }) {
  const { t } = useI18n();
  const set = (key) => (event) =>
    onChange({
      ...draft,
      [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
    });
  const id = (key) => `${prefix}-${key}`;
  const field = (key, label, control) => (
    <div className="field">
      <label htmlFor={id(key)}>{label}</label>
      {control}
    </div>
  );
  return (
    <>
      {field(
        'ready',
        t('marketplaceRequests.post.ready'),
        <select id={id('ready')} value={draft.ready} onChange={set('ready')}>
          {READY.map((choice) => (
            <option key={choice} value={choice}>
              {t(`marketplaceRequests.board.ready.${choice}`)}
            </option>
          ))}
        </select>,
      )}
      {field(
        'furnishing',
        t('marketplaceRequests.post.furnishing'),
        <select id={id('furnishing')} value={draft.furnishing} onChange={set('furnishing')}>
          {FURNISHING.map((choice) => (
            <option key={choice} value={choice}>
              {t(`marketplaceRequests.board.furnishing.${choice}`)}
            </option>
          ))}
        </select>,
      )}
      {draft.purpose === 'rent' &&
        field(
          'cheques',
          t('marketplaceRequests.post.cheques'),
          <select id={id('cheques')} value={draft.cheques} onChange={set('cheques')}>
            <option value="">{t('marketplaceRequests.post.chequesAny')}</option>
            {CHEQUES.map((count) => (
              <option key={count} value={String(count)}>
                {t('marketplaceRequests.board.cheques', { count })}
              </option>
            ))}
          </select>,
        )}
      {field(
        'buildingAge',
        t('marketplaceRequests.post.buildingAge'),
        <select id={id('buildingAge')} value={draft.buildingAge} onChange={set('buildingAge')}>
          {AGES.map((choice) => (
            <option key={choice} value={choice}>
              {t(`marketplaceRequests.board.age.${choice}`)}
            </option>
          ))}
        </select>,
      )}
      {field(
        'moveIn',
        t('marketplaceRequests.post.moveIn'),
        <input id={id('moveIn')} type="month" value={draft.moveIn} onChange={set('moveIn')} />,
      )}
      <div className="field field-wide">
        <label htmlFor={id('communities')}>{t('marketplaceRequests.post.communities')}</label>
        <textarea
          id={id('communities')}
          rows={3}
          value={draft.communities}
          onChange={set('communities')}
        />
        <p className="market-hint">{t('marketplaceRequests.post.communitiesHint')}</p>
        <label className="market-check">
          <input
            type="checkbox"
            checked={Boolean(draft.openToOtherAreas)}
            onChange={set('openToOtherAreas')}
          />
          {t('marketplaceRequests.post.openToOtherAreas')}
        </label>
      </div>
    </>
  );
}
