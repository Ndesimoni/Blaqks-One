import React, { useId } from 'react';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';

/**
 * The shared centred finance dialog: titled, focus-trapped (native modal), Escape and the
 * close button route through `onClose`, which callers guard while saving. The body scrolls
 * while the title and actions stay reachable. `message` is the server's refusal; the caller
 * keeps its draft so nothing typed is lost on 403/409.
 */
export function FinanceDialog({
  eyebrow,
  title,
  intro,
  busy,
  message,
  onClose,
  onSubmit,
  submitLabel,
  submitDisabled = false,
  danger = false,
  wide = false,
  className = '',
  children,
}) {
  const titleId = useId();
  const close = () => {
    if (!busy) onClose();
  };
  return (
    <Drawer
      className={`finance-dialog ${className}`}
      size={wide ? 'wide' : 'standard'}
      titleId={titleId}
      onClose={close}
    >
      <div className="drawer-top">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 id={titleId} tabIndex={-1} data-initial-focus>
            {title}
          </h2>
          {intro && <p>{intro}</p>}
        </div>
        <button className="icon-btn" aria-label={`Close ${title}`} disabled={busy} onClick={close}>
          <Icon name="close" size={21} />
        </button>
      </div>
      <form
        className="drawer-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !submitDisabled) onSubmit?.();
        }}
      >
        <div className="drawer-body finance-dialog-body">
          {children}
          {message && (
            <div className="finance-alert" role="alert">
              <Icon name="info" size={18} />
              <p>{message}</p>
            </div>
          )}
        </div>
        <div className="drawer-footer">
          <Button variant="light" disabled={busy} onClick={close}>
            {onSubmit ? 'Cancel' : 'Close'}
          </Button>
          {onSubmit && (
            <Button
              type="submit"
              className={danger ? 'finance-danger' : ''}
              disabled={busy || submitDisabled}
            >
              {busy ? 'Saving…' : submitLabel}
            </Button>
          )}
        </div>
      </form>
    </Drawer>
  );
}

/**
 * A failed action's text. After a version conflict the dialog already shows the refreshed
 * deal, so the user checks the latest figures and saves again with their entries kept.
 */
export function failureText(result) {
  if (result.conflict)
    return 'This deal changed since you opened it. The latest figures are shown and your entries are kept. Check them and try again.';
  return result.message || 'The change could not be saved. Your entries are kept.';
}

/** A required reason (1–500 characters), counted like the server counts it. */
export function ReasonField({ id, label = 'Reason', value, onChange, error, hint, disabled }) {
  const size = [...value.trim()].length;
  const describedBy = [`${id}-count`, error ? `${id}-error` : ''].filter(Boolean).join(' ');
  return (
    <div className="field span-all">
      <label htmlFor={id}>
        {label}
        <span className="required"> *</span>
      </label>
      <textarea
        id={id}
        rows={3}
        maxLength={2000}
        value={value}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
      />
      <small id={`${id}-count`} className="finance-hint">
        {hint ? `${hint} ` : ''}
        {size}/500 characters
      </small>
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
