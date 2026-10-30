import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { N } from '../../lib/format.js';
import { VISIBLE_OPTION_LIMIT } from '../../lib/overflow.js';

const SOURCE_FILTER_LIMIT = VISIBLE_OPTION_LIMIT;

export function LeadSourceFilters({ sources, selectedSource, total, onChange }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const anchorRef = useRef(null);
  const moreRef = useRef(null);
  const menuRef = useRef(null);
  // All sources occupies one of the six compact filter slots.
  const visibleSources = sources.slice(0, SOURCE_FILTER_LIMIT - 1);
  const selected = sources.find(
    (item) => item.label.toLowerCase() === selectedSource.toLowerCase(),
  );
  if (selected && !visibleSources.includes(selected)) {
    visibleSources[visibleSources.length - 1] = selected;
  }
  const extraSources = sources.filter((item) => !visibleSources.includes(item));
  const hasMoreSources = extraSources.length > 0;
  const closeMenu = useCallback((restoreFocus = false) => {
    setMenuOpen(false);
    if (restoreFocus) moreRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    if (!hasMoreSources) {
      closeMenu();
      return;
    }
    const positionMenu = () => {
      const anchorElement = anchorRef.current;
      const menu = menuRef.current;
      if (!anchorElement || !menu) return;
      const anchor = anchorElement.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      const left = Math.max(16, Math.min(anchor.left, width - menu.offsetWidth - 16));
      menu.style.left = `${left - anchor.left}px`;
      const below = innerHeight - anchor.bottom - 8;
      const above = anchor.top - 8;
      const placeAbove = below < menu.offsetHeight + 16 && above > below;
      menu.style.top = placeAbove ? 'auto' : 'calc(100% + 8px)';
      menu.style.bottom = placeAbove ? 'calc(100% + 8px)' : 'auto';
    };
    const closeOutside = (event) => {
      if (!anchorRef.current?.contains(event.target)) closeMenu();
    };
    const escape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu(true);
      }
    };
    positionMenu();
    menuRef.current.querySelector('.lead-source-choice')?.focus({ preventScroll: true });
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', positionMenu);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', positionMenu);
    };
  }, [menuOpen, hasMoreSources, closeMenu]);

  return (
    <div className="lead-source-options">
      <div className="lead-source-filter-list" role="group" aria-label="Filter leads by source">
        <button aria-pressed={!selectedSource} onClick={() => onChange('')}>
          All sources <span>{N(total)}</span>
        </button>
        {visibleSources.map((item) => (
          <button
            key={item.label}
            aria-pressed={selectedSource.toLowerCase() === item.label.toLowerCase()}
            onClick={() => onChange(item.label)}
          >
            {item.label} <span>{N(item.count)}</span>
          </button>
        ))}
      </div>
      {hasMoreSources && (
        <div className="lead-source-more" ref={anchorRef}>
          <button
            ref={moreRef}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((current) => !current)}
          >
            More <Icon name="down" size={14} />
          </button>
          {menuOpen && (
            <div
              id={menuId}
              ref={menuRef}
              className="lead-source-menu"
              role="group"
              aria-label="All lead sources"
            >
              <div className="lead-source-menu-heading">
                <strong>All lead sources</strong>
                <button
                  className="lead-source-menu-close"
                  aria-label="Close source filters"
                  onClick={() => closeMenu(true)}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
              <button
                className="lead-source-choice"
                aria-pressed={!selectedSource}
                onClick={() => {
                  onChange('');
                  closeMenu(true);
                }}
              >
                All sources <span>{N(total)}</span>
              </button>
              {sources.map((item) => (
                <button
                  className="lead-source-choice"
                  key={item.label}
                  aria-pressed={selectedSource.toLowerCase() === item.label.toLowerCase()}
                  onClick={() => {
                    onChange(item.label);
                    closeMenu(true);
                  }}
                >
                  {item.label} <span>{N(item.count)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
