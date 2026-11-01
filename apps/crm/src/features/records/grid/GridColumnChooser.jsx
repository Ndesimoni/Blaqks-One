import React, { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { columnHeading } from './columnHeadings.js';
import './grid-columns.css';

/**
 * The grid's column chooser: the mockup's gear button, opening every column of the sheet as a checkbox.
 * It stays open while columns are ticked; Escape or a click outside closes it. The identity
 * column cannot be removed.
 */
export function GridColumnChooser({ module, grid }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const button = useRef(null);
  const id = useId();
  useEffect(() => {
    if (!open) return undefined;
    const dismiss = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  return (
    <div
      className="grid-columns"
      ref={root}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return;
        event.stopPropagation();
        setOpen(false);
        button.current?.focus();
      }}
    >
      <button
        ref={button}
        type="button"
        className="grid-tool"
        aria-label={t('recordGrid.columns')}
        title={t('recordGrid.columns')}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="settings" size={20} />
      </button>
      {open && (
        <div
          className="grid-columns-panel"
          id={id}
          role="group"
          aria-label={t('recordGrid.columnsTitle')}
        >
          <p className="grid-columns-title">{t('recordGrid.columnsTitle')}</p>
          <p className="grid-columns-hint">{t('recordGrid.columnsHint')}</p>
          <div className="grid-columns-list">
            {grid.fields.map((field) => (
              <label key={field.key}>
                <input
                  type="checkbox"
                  checked={grid.columns.includes(field.name)}
                  disabled={field.name === grid.identity}
                  onChange={() => grid.toggle(field.name)}
                />
                <span>{columnHeading(module, field.name)}</span>
                {field.name === grid.identity && <small>{t('recordGrid.columnsFixed')}</small>}
              </label>
            ))}
          </div>
          {/* aria-disabled, not disabled: focus stays on the button after restoring. */}
          <button
            type="button"
            className="grid-columns-reset"
            aria-disabled={grid.isDefault}
            onClick={() => !grid.isDefault && grid.reset()}
          >
            {t('recordGrid.columnsReset')}
          </button>
        </div>
      )}
    </div>
  );
}
