import React, { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../../../../components/ui/Icon.jsx';
import { useI18n } from '../../../../i18n/useI18n.js';
import { ManageSavedReplies } from './ManageSavedReplies.jsx';
import { fillIn, insertReply } from './savedRepliesModel.js';
import { SavedRepliesPicker } from './SavedRepliesPicker.jsx';
import { useSavedReplies } from './useSavedReplies.js';

/** Above the button, end-aligned, or below when there is no room; phones use a sheet (CSS). */
function place(button, popover) {
  popover.style.cssText = '';
  if (window.matchMedia('(max-width: 599px)').matches) return;
  const rect = button.getBoundingClientRect();
  const width = Math.min(360, window.innerWidth - 32);
  const left = Math.min(Math.max(16, rect.right - width), window.innerWidth - width - 16);
  Object.assign(popover.style, { inlineSize: `${width}px`, left: `${left}px` });
  if (rect.top >= 288) popover.style.bottom = `${window.innerHeight - rect.top + 8}px`;
  else popover.style.top = `${rect.bottom + 8}px`;
}

/**
 * The saved-replies button inside the message box (docs/saved-replies-drafts.md §5). The
 * picker is a native popover kept inside the form, so it also works in New email's dialog;
 * choosing a reply fills it in and puts it in the box at the cursor.
 */
export function SavedRepliesButton({ textareaRef, text, setText, values, disabled }) {
  const { t } = useI18n();
  const saved = useSavedReplies();
  const id = useId();
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  const selection = useRef([0, 0]);
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(null);
  const [message, setMessage] = useState('');
  // The button opens the popover through `popovertarget`, so the browser keeps a click on
  // it from closing and reopening the picker; the cursor is kept for the insert.
  useEffect(() => {
    const popover = popoverRef.current;
    const toggle = (event) => {
      const opening = event.newState === 'open';
      if (opening) {
        const area = textareaRef.current;
        const end = area?.value.length ?? 0;
        selection.current = [area?.selectionStart ?? end, area?.selectionEnd ?? end];
        setMessage('');
        place(buttonRef.current, popover);
      }
      setOpen(opening);
    };
    popover?.addEventListener('toggle', toggle);
    return () => popover?.removeEventListener('toggle', toggle);
  }, [textareaRef]);
  useEffect(() => {
    if (!open) return undefined;
    // A turned tablet or resized window moves it, or makes it the phone sheet.
    const follow = () => place(buttonRef.current, popoverRef.current);
    window.addEventListener('resize', follow);
    return () => window.removeEventListener('resize', follow);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    if (!saved.data && !saved.loading) saved.load();
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const target = touch ? popoverRef.current : popoverRef.current?.querySelector('input');
    target?.focus({ preventScroll: true });
    // Runs once per opening on purpose: `saved` changes while it loads.
  }, [open]);
  const hide = (focus) => {
    if (popoverRef.current?.matches(':popover-open')) popoverRef.current.hidePopover();
    focus?.focus({ preventScroll: true });
  };
  const choose = (reply) => {
    const next = insertReply(text, fillIn(reply.body, values), ...selection.current);
    if (!next) return setMessage(t('inboxSaved.picker.tooLong'));
    setText(next.text);
    hide();
    requestAnimationFrame(() => {
      const area = textareaRef.current;
      area?.focus();
      area?.setSelectionRange(next.caret, next.caret);
    });
  };
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={'composer-tool' + (open ? ' is-open' : '')}
        aria-label={t('inboxSaved.button')}
        title={t('inboxSaved.button')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        popovertarget={id}
        disabled={disabled}
      >
        <Icon name="bolt" size={18} />
      </button>
      <div
        ref={popoverRef}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={t('inboxSaved.button')}
        tabIndex={-1}
        className="saved-picker"
      >
        {open && (
          <SavedRepliesPicker
            saved={saved}
            message={message}
            onChoose={choose}
            onClose={() => hide(buttonRef.current)}
            onManage={(start) => {
              hide(buttonRef.current);
              setManaging(start);
            }}
          />
        )}
      </div>
      {managing && (
        <ManageSavedReplies saved={saved} start={managing} onClose={() => setManaging(null)} />
      )}
    </>
  );
}
