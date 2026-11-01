import React, { useRef } from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import './grid-filter.css';

/**
 * The grid's filter bar (Bitrix24 list pattern, NAV): one search field showing the active
 * preset as a pill, the page's existing filters as preset chips, then the page's tools (the
 * column chooser) and any extra filter such as the connected "Assigned to".
 */
export function GridFilterBar({
  module,
  presetLabel,
  tabs,
  tab,
  onTab,
  query,
  onQuery,
  tools = null,
  extras = null,
}) {
  const { t } = useI18n();
  const input = useRef(null);
  const presets = tabs.length > 1;
  const filtered = Boolean(query) || (presets && tab !== tabs[0]);
  const className =
    'grid-filterbar' + (presets ? ' has-presets' : '') + (tools ? ' has-tools' : '');
  return (
    <div className={className}>
      <div
        className="grid-filter-field"
        onPointerDown={(event) => {
          // The whole field focuses its input, as one control, except the clear button.
          if (event.target.closest('button, input')) return;
          event.preventDefault();
          input.current?.focus();
        }}
      >
        <Icon name="search" size={16} />
        <span className="grid-preset-pill" aria-hidden="true">
          {presetLabel}
        </span>
        <input
          ref={input}
          aria-label={'Search ' + module}
          placeholder={t('recordGrid.placeholder')}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
        />
        {filtered && (
          <button
            type="button"
            className="grid-filter-clear"
            aria-label={t('recordGrid.clear')}
            title={t('recordGrid.clear')}
            onClick={() => {
              onQuery('');
              if (presets) onTab(tabs[0]);
              input.current?.focus();
            }}
          >
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      {presets && (
        <div className="grid-presets" role="group" aria-label={`Filter ${module}`}>
          {tabs.map((name) => (
            <button
              key={name}
              type="button"
              className="grid-chip"
              aria-pressed={name === tab}
              onClick={() => onTab(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {tools}
      {extras}
    </div>
  );
}
