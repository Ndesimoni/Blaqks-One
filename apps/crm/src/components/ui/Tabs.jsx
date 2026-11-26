import React, { useRef } from 'react';
import './tabs.css';

/** The tab and panel ids shared by `Tabs` and the panels its caller renders. */
export const tabIds = (idPrefix, id) => ({
  tab: `${idPrefix}-tab-${id}`,
  panel: `${idPrefix}-panel-${id}`,
});

/**
 * Props for one caller-rendered panel. Inactive panels stay mounted and are hidden, so
 * drafts and open dialogs inside them survive a tab switch.
 */
export function tabPanelProps(idPrefix, id, value) {
  const ids = tabIds(idPrefix, id);
  return { role: 'tabpanel', id: ids.panel, 'aria-labelledby': ids.tab, hidden: value !== id };
}

const MOVES = {
  ArrowRight: (index, size) => (index + 1) % size,
  ArrowLeft: (index, size) => (index - 1 + size) % size,
  Home: () => 0,
  End: (index, size) => size - 1,
};

/**
 * An accessible tab row (WAI-ARIA tabs, manual activation): arrow keys, Home and End move
 * focus, Enter, Space or a click selects. Only the selected tab is in the Tab order. The row
 * scrolls sideways on narrow screens. `tabs` is `[{ id, label, count? }]`.
 */
export function Tabs({ label, tabs, value, onChange, idPrefix, className = '' }) {
  const refs = useRef([]);
  const onKeyDown = (event, index) => {
    const move = MOVES[event.key];
    if (!move) return;
    event.preventDefault();
    const next = refs.current[move(index, tabs.length)];
    next?.focus();
    next?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };
  return (
    <div className={`tabs ui-tabs ${className}`.trim()} role="tablist" aria-label={label}>
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        const ids = tabIds(idPrefix, tab.id);
        return (
          <button
            key={tab.id}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={ids.tab}
            aria-selected={selected}
            aria-controls={ids.panel}
            tabIndex={selected ? 0 : -1}
            className={selected ? 'active' : ''}
            onClick={() => {
              if (!selected) onChange(tab.id);
            }}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count !== null && (
              <span className="ui-tab-count">{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
