import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { initials } from '../profile/profileModel.js';
import { splitMatch } from './searchModel.js';

function Highlight({ text, query }) {
  const [before, match, after] = splitMatch(text, query);
  return (
    <>
      {before}
      {match && <mark>{match}</mark>}
      {after}
    </>
  );
}

/**
 * Search matches grouped by collection, each group with its full count and up to `limit`
 * people or listings; choosing one opens its record panel through `onPick`.
 */
export function SearchHits({ groups, query, limit, onPick }) {
  const { t } = useI18n();
  return groups.map((group) => {
    const name = t(`frame.groups.${group.module}`);
    const shown = group.hits.slice(0, limit);
    return (
      <section key={group.module} className="search-group" aria-label={name}>
        <h3 className="search-group-title">
          <span>{name}</span>
          <span className="search-count">{group.hits.length}</span>
        </h3>
        {shown.map((hit, index) => (
          <button
            type="button"
            key={`${hit.id}-${index}`}
            className="search-hit"
            onClick={() => onPick(hit)}
          >
            <span className="search-avatar" aria-hidden="true">
              {initials(hit.title)}
            </span>
            <span className="search-text">
              <strong>
                <Highlight text={hit.title} query={query} />
              </strong>
              {hit.detail && <span>{hit.detail}</span>}
            </span>
          </button>
        ))}
        {shown.length < group.hits.length && limit > 4 && (
          <p className="search-more">
            {t('frame.searchMore', { shown: shown.length, count: group.hits.length })}
          </p>
        )}
      </section>
    );
  });
}
