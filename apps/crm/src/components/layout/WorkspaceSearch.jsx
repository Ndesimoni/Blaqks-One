import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/Icon.jsx';
import { useNavigation, useWorkspaceView } from '../../hooks/useWorkspace.js';

export function WorkspaceSearch() {
  const { navigate, route } = useNavigation();
  const { query, setQuery } = useWorkspaceView();
  const [expanded, setExpanded] = useState(false);
  const searchRef = useRef(null);
  const inputRef = useRef(null);
  useEffect(() => setExpanded(false), [route]);
  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);
  useEffect(() => {
    const shortcut = (event) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      if (document.querySelector('dialog[open]')) return;
      event.preventDefault();
      setExpanded(true);
      inputRef.current?.focus();
    };
    const outside = (event) => {
      if (!searchRef.current?.contains(event.target)) setExpanded(false);
    };
    window.addEventListener('keydown', shortcut);
    document.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('keydown', shortcut);
      document.removeEventListener('pointerdown', outside);
    };
  }, []);
  return (
    <div className="workspace-search" ref={searchRef} data-expanded={expanded}>
      <button
        type="button"
        className="icon-btn mobile-search-toggle"
        aria-label="Search workspace"
        aria-expanded={expanded}
        aria-controls="workspace-search-field"
        onClick={() => setExpanded(!expanded)}
      >
        <Icon name="search" size={20} />
      </button>
      <div className="top-center" id="workspace-search-field">
        <Icon name="search" size={17} />
        <input
          ref={inputRef}
          id="global-search"
          aria-label="Search CRM records"
          placeholder="Search your workspace"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && query) {
              navigate('Client desk', query);
              setExpanded(false);
            }
            if (event.key === 'Escape') {
              setExpanded(false);
              searchRef.current?.querySelector('button')?.focus();
            }
          }}
        />
        <kbd aria-hidden="true">⌘ K</kbd>
      </div>
    </div>
  );
}
