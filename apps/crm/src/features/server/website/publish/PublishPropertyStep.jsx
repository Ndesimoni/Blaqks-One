import React, { useId, useMemo, useState } from 'react';
import { Badge } from '../../../../components/ui/Badge.jsx';
import { Icon } from '../../../../components/ui/Icon.jsx';
import { useRecords } from '../../../../hooks/useWorkspace.js';
import { useI18n } from '../../../../i18n/useI18n.js';
import { liveRecordIds } from '../listings/listingsModel.js';
import { isListable } from './publishModel.js';
import { ReadinessList } from './ReadinessList.jsx';

const words = (record) =>
  [record.listing_title, record.community, record.property_id].join(' ').toLowerCase();

/**
 * Step 1 from the Properties tab: a searchable, bounded list of Available and Under-offer
 * properties (one already live republishes), then the chosen property's readiness.
 */
export function PublishPropertyStep({ flow, publications }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`websitePublish.${key}`, vars);
  const { entries } = useRecords();
  const id = useId();
  const [query, setQuery] = useState('');
  const live = useMemo(() => liveRecordIds(publications), [publications]);
  const choices = useMemo(
    () => (entries?.Properties || []).filter((entry) => isListable(entry.record)),
    [entries],
  );
  const needle = query.trim().toLowerCase();
  const shown = needle ? choices.filter((entry) => words(entry.record).includes(needle)) : choices;
  const missing = flow.errors.property === 'chooseProperty';
  return (
    <>
      <div className="search-small website-publish-search">
        <Icon name="search" size={16} />
        <input
          type="search"
          aria-label={k('searchProperties')}
          placeholder={k('searchPlaceholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <fieldset className="website-publish-choices">
        <legend className="sr-only">{k('propertyLegend')}</legend>
        {!choices.length && <p className="website-publish-note">{k('noProperties')}</p>}
        {choices.length > 0 && !shown.length && (
          <p className="website-publish-note">{k('noPropertyMatches')}</p>
        )}
        {shown.length > 0 && (
          <ul className="website-publish-list">
            {shown.map((entry) => (
              <li key={entry.id}>
                <label>
                  <input
                    type="radio"
                    name={`${id}-property`}
                    checked={flow.draft.recordId === entry.id}
                    aria-invalid={missing}
                    aria-describedby={missing ? `${id}-error` : undefined}
                    onChange={() => flow.choose(entry)}
                  />
                  <span className="website-publish-choice">
                    <strong>{entry.record.listing_title || entry.record.property_id}</strong>
                    <small>
                      {[entry.record.community, entry.record.listing_status]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  </span>
                  {live.has(entry.id) && <Badge tone="green">{k('liveChoice')}</Badge>}
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      {missing && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {k('chooseProperty')}
        </p>
      )}
      {flow.entry && (
        <ReadinessList entry={flow.entry} invalid={flow.errors.property === 'notReady'} />
      )}
    </>
  );
}
