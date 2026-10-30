import React, { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { preferredCols } from '../../config/navigation.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { useWorkspaceView } from '../../hooks/useWorkspace.js';
import { useI18n } from '../../i18n/useI18n.js';
import { schema } from '../../lib/schema.js';
import './sort.css';

/** Card directories retain the same field/direction state as the desktop column headers. */
export function RecordSort({ module, columnNames }) {
  const { t } = useI18n();
  const { sort, setSort, setPage } = useWorkspaceView();
  const mobile = useMediaQuery('(max-width: 750px)');
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const id = useId();
  const columns = schema(module);
  const fields = (columnNames || preferredCols[module] || [])
    .map((name) => columns.find((field) => field.name === name))
    .filter(Boolean);
  const active = columns.find((field) => field.key === sort.key);
  if (active && !fields.includes(active)) fields.push(active);
  useEffect(() => {
    if (!open) return undefined;
    const dismiss = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  if (!mobile) return null;
  const update = (change) => {
    setSort((current) => ({ ...current, ...change }));
    setPage(0);
  };
  return (
    <div
      className="record-sort"
      ref={root}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return;
        event.stopPropagation();
        setOpen(false);
        root.current.querySelector('button').focus();
      }}
    >
      <Button
        variant="light"
        aria-label={t('recordSorting.open')}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        {t('recordSorting.short')}
      </Button>
      {open && (
        <div
          className="record-sort-panel"
          role="group"
          aria-label={t('recordSorting.group')}
          id={id}
        >
          <label>
            <span>{t('recordSorting.field')}</span>
            <select value={sort.key} onChange={(event) => update({ key: event.target.value })}>
              <option value="">{t('recordSorting.default')}</option>
              {fields.map((field) => (
                <option key={field.key} value={field.key}>
                  {field.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t('recordSorting.direction')}</span>
            <select
              value={sort.direction}
              onChange={(event) => update({ direction: event.target.value })}
            >
              <option value="asc">{t('recordSorting.ascending')}</option>
              <option value="desc">{t('recordSorting.descending')}</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
