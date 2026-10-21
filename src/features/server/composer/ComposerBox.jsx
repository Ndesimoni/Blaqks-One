import React, { useRef } from 'react';
import { AttachButton } from './AttachButton.jsx';
import { ComposerFiles } from './ComposerFiles.jsx';
import { useAutoGrow } from './useAutoGrow.js';
import './composer.css';
import './composer-files.css';
import './composer-phone.css';

/**
 * One message row for every composer (Inbox reply and note, New email, team chat), laid out
 * as in Messenger and WhatsApp (owner, 2026-10-22): the "+" (attach) outside on the start
 * side, the rounded typing box with any chosen files inside above the text, and the send
 * action on the end side, all aligned to the bottom as the box grows. The short `meta` note
 * sits under the row. Pass `files` from useAttachments only where attachments are allowed.
 */
export function ComposerBox({ files, attachDisabled, meta, action, className = '', children }) {
  const box = useRef(null);
  useAutoGrow(box);
  // A click on the box's empty space puts the cursor in the text, as in mail and chat apps.
  const focusText = (event) => {
    if (event.target === event.currentTarget)
      event.currentTarget.querySelector('textarea')?.focus();
  };
  return (
    <div className={'composer-group' + (files ? ' has-attach' : '')}>
      <div className="composer-row">
        {files && <AttachButton files={files} disabled={attachDisabled} />}
        <div ref={box} className={('composer-box ' + className).trim()} onClick={focusText}>
          {files && <ComposerFiles files={files} />}
          {children}
        </div>
        {action}
      </div>
      {meta && <div className="composer-meta">{meta}</div>}
    </div>
  );
}
