import React, { useMemo, useState } from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useRecords, useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { canOpenSection } from '../access.js';
import { SearchHits } from './SearchHits.jsx';
import { SearchResultsPanel } from './SearchResultsPanel.jsx';
import { MIN_QUERY, SEARCHED, searchWorkspace } from './searchModel.js';
import { useDisclosure } from './useDisclosure.js';
import './search.css';

const PREVIEW = 4;
const matchButtons = (root) => [...(root?.querySelectorAll('.search-dropdown button') || [])];

/**
 * The top bar's search (NAV5, Bitrix24's header): matches appear under the field as you type,
 * and Enter or See all opens every match in a panel. Only collections this person can open
 * are searched, within the records their workspace scope already gives them.
 */
export function HeaderSearch() {
  const { t } = useI18n();
  const { user } = useSession();
  const { data, loading } = useRecords();
  const actions = useWorkspaceActions();
  const { open, setOpen, root, opener } = useDisclosure();
  const [query, setQuery] = useState('');
  const [panel, setPanel] = useState(false);
  const key = SEARCHED.filter((module) => canOpenSection(user, module)).join();
  const groups = useMemo(() => searchWorkspace(data, query, key.split(',')), [data, query, key]);
  if (!key) return null;
  const count = groups.reduce((sum, group) => sum + group.hits.length, 0);
  const ready = query.trim().length >= MIN_QUERY;
  // The field holds focus while the panel opens, so closing the panel returns focus to it.
  const showAll = () => {
    opener.current?.focus();
    setOpen(false);
    setPanel(true);
  };
  const pick = (hit) => {
    setOpen(false);
    setPanel(false);
    opener.current?.focus();
    actions.dispatchRow(hit.module, hit.record);
  };
  // Down from the field enters the matches; Up from the first match returns to the field.
  const move = (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = matchButtons(root.current);
    const next = items.indexOf(document.activeElement) + (event.key === 'ArrowDown' ? 1 : -1);
    if (next < 0) opener.current?.focus();
    else items[Math.min(next, items.length - 1)]?.focus();
  };
  return (
    <div className="header-search" ref={root} data-tour="search">
      <label className="search-box">
        <Icon name="search" size={16} />
        <input
          ref={opener}
          type="search"
          aria-label={t('frame.search')}
          placeholder={t('frame.search')}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          // Matches open on typing, a click or Down, not on focus: Escape returns focus here
          // and the matches stay closed.
          onClick={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && !open) {
              event.preventDefault();
              setOpen(true);
            } else if (event.key === 'ArrowDown') move(event);
            if (event.key !== 'Enter' || !ready) return;
            event.preventDefault();
            showAll();
          }}
        />
      </label>
      {open && ready && (
        <div className="search-dropdown" onKeyDown={move}>
          <p className="sr-only" role="status">
            {loading ? t('frame.searchLoading') : t('frame.matches', { count })}
          </p>
          {loading ? (
            <p className="search-none">{t('frame.searchLoading')}</p>
          ) : count ? (
            <>
              <SearchHits groups={groups} query={query} limit={PREVIEW} onPick={pick} />
              <button type="button" className="search-all" onClick={showAll}>
                {t('frame.searchAll', { count })}
              </button>
            </>
          ) : (
            <p className="search-none">{t('frame.searchNone', { query: query.trim() })}</p>
          )}
        </div>
      )}
      {panel && (
        <SearchResultsPanel
          groups={groups}
          query={query}
          loading={loading}
          onQuery={setQuery}
          onPick={pick}
          onClose={() => setPanel(false)}
        />
      )}
    </div>
  );
}
