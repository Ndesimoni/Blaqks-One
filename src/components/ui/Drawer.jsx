import React, { useEffect, useId, useRef } from 'react';

/** Native modal dialogs provide background inertness, focus containment and Escape. */
export function Drawer({
  children,
  className = '',
  placement = 'center',
  size = 'standard',
  titleId,
  onClose,
}) {
  const dialogRef = useRef(null);
  const generatedId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    dialog.querySelector('[data-initial-focus]:not(:disabled)')?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className={'modal-root' + (placement === 'center' ? ' modal-centered' : '')}
      aria-modal="true"
      aria-labelledby={titleId || generatedId}
      onKeyDown={(event) => {
        // A nested dialog's keys bubble through React; only this dialog's own Tab is handled.
        if (event.key !== 'Tab' || event.target.closest('dialog') !== dialogRef.current) return;
        const elements = Array.from(
          dialogRef.current.querySelectorAll(
            'button, a[href], input, select, textarea, [tabindex]',
          ),
        ).filter(
          (element) =>
            element.tabIndex >= 0 && !element.disabled && element.getClientRects().length,
        );
        const first = elements[0];
        const last = elements.at(-1);
        if (!first) {
          event.preventDefault();
          return;
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(event) => {
        // React bubbles `cancel` to an outer Drawer; Escape must close only the topmost dialog.
        event.stopPropagation();
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={'drawer ' + (size === 'wide' ? 'drawer-wide ' : '') + className}>
        {children}
      </div>
    </dialog>
  );
}
