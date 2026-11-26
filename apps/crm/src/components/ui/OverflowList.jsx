import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon.jsx';
import { optionKey, partitionOptions } from '../../lib/overflow.js';

/** Compact disclosure, continuous scroll list, or complete page collection. */
export function OverflowList({
  items,
  label,
  mode = 'disclosure',
  getKey = optionKey,
  activeKey,
  renderItem,
  renderList,
  listClassName = '',
  itemClassName = '',
  className = '',
  listTag: List = 'ul',
  listStyle,
  after,
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef(null);
  const moreRef = useRef(null);
  const scrollRef = useRef(null);
  const { all, visible, extra } = partitionOptions(items, activeKey, getKey);
  const hasMore = mode === 'disclosure' && extra.length > 0;
  const expanded = open && hasMore;
  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      // One stable More/Close control also restores focus after a record dialog closes.
      const target =
        moreRef.current ||
        rootRef.current?.querySelector('button:not(:disabled), input:not(:disabled), a[href]');
      target?.focus({ preventScroll: true });
    }
  }, []);
  useEffect(() => {
    if (!open) return;
    if (!hasMore) {
      close(true);
      return;
    }
    const outside = (event) => {
      if (!rootRef.current?.contains(event.target)) close();
    };
    const first = scrollRef.current?.querySelector(
      'button:not(:disabled), input:not(:disabled), a[href]',
    );
    (first || rootRef.current)?.focus({ preventScroll: true });
    rootRef.current?.scrollIntoView({ block: 'nearest' });
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
    };
  }, [open, hasMore, close]);
  const entries = mode === 'disclosure' && !expanded ? visible : all;
  const name = expanded ? `All ${label.toLowerCase()}` : label;
  const controls = { close: () => expanded && close(true) };
  return (
    <div
      className={`overflow-list overflow-mode-${mode}${expanded ? ' overflow-list-panel' : ''} ${className}`}
      ref={rootRef}
      role={expanded ? 'region' : undefined}
      aria-label={expanded ? `More ${label.toLowerCase()}` : undefined}
      tabIndex={expanded ? -1 : undefined}
      onKeyDown={(event) => {
        if (expanded && event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close(true);
        }
      }}
    >
      {expanded && (
        <div className="overflow-list-heading">
          <strong>{label}</strong>
          <small>{all.length} items</small>
        </div>
      )}
      <div
        id={id}
        ref={scrollRef}
        className={expanded || mode === 'scroll' ? 'overflow-list-scroll' : undefined}
      >
        {renderList ? (
          renderList(entries, name, controls)
        ) : (
          <List
            className={`overflow-list-items ${listClassName}`}
            aria-label={name}
            style={listStyle}
          >
            {entries.map(({ item, index, key }) => (
              <li className={`overflow-list-item ${itemClassName}`} key={key}>
                {renderItem(item, index, controls)}
              </li>
            ))}
            {after && (
              <li className="overflow-list-after" role="presentation">
                {after}
              </li>
            )}
          </List>
        )}
      </div>
      {hasMore && (
        <button
          type="button"
          className={`overflow-more-button${expanded ? ' overflow-close-button' : ''}`}
          ref={moreRef}
          aria-label={
            expanded
              ? `Close more ${label.toLowerCase()}`
              : `More ${label.toLowerCase()} (${extra.length})`
          }
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => (expanded ? close(true) : setOpen(true))}
        >
          {expanded ? (
            <Icon name="close" size={17} />
          ) : (
            <>
              More <span className="overflow-more-count">{extra.length}</span>
              <Icon name="down" size={14} />
            </>
          )}
        </button>
      )}
    </div>
  );
}
