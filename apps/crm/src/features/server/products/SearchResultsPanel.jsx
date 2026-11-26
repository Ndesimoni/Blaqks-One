import React from 'react';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { SearchHits } from './SearchHits.jsx';
import { MIN_QUERY } from './searchModel.js';
import './search-panel.css';

const PANEL_LIMIT = 50;

/**
 * Every match for the search, in a panel from the right edge (Bitrix24's search results).
 * The search can be refined here; choosing a match opens its record panel.
 */
export function SearchResultsPanel({ groups, query, loading, onQuery, onPick, onClose }) {
  const { t } = useI18n();
  const count = groups.reduce((sum, group) => sum + group.hits.length, 0);
  const text = query.trim();
  const summary = loading
    ? t('frame.searchLoading')
    : text.length < MIN_QUERY
      ? t('frame.searchHint')
      : count
        ? t('frame.resultsFor', { count, query: text })
        : t('frame.searchNone', { query: text });
  return (
    <Drawer
      placement="right"
      className="search-drawer"
      titleId="search-results-title"
      onClose={onClose}
    >
      <div className="search-panel">
        <div className="search-panel-head">
          <h2 id="search-results-title">{t('frame.results')}</h2>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('frame.closeResults')}
            onClick={onClose}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <label className="search-box">
          <Icon name="search" size={16} />
          <input
            type="search"
            data-initial-focus
            aria-label={t('frame.search')}
            placeholder={t('frame.search')}
            value={query}
            onChange={(event) => onQuery(event.target.value)}
          />
        </label>
        <p className="search-summary" role="status">
          {summary}
        </p>
        <div className="search-panel-list">
          {!loading && (
            <SearchHits groups={groups} query={query} limit={PANEL_LIMIT} onPick={onPick} />
          )}
        </div>
      </div>
    </Drawer>
  );
}
