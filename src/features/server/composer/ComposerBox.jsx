import React, { useRef } from 'react';
import { AttachButton } from './AttachButton.jsx';
import { ComposerFiles } from './ComposerFiles.jsx';
import { useAutoGrow } from './useAutoGrow.js';
import './composer.css';
import './composer-files.css';

/**
 * One message box for every composer (Inbox reply, New email, team chat): chosen files sit
 * inside it above the text, and its bottom bar holds the "+" (attach), a short note and the
 * send action. Pass `files` from useAttachments only where attachments are allowed.
 */
export function ComposerBox({ files, attachDisabled, meta, action, className = '', children }) {
  const bar = Boolean(files || meta || action);
  const box = useRef(null);
  useAutoGrow(box);
  // A click on the box's empty space puts the cursor in the text, as in mail and chat apps.
  const focusText = (event) => {
    if (event.target === event.currentTarget || event.target.dataset.composerSpace) {
      event.currentTarget.querySelector('textarea')?.focus();
    }
  };
  return (
    <div ref={box} className={('composer-box ' + className).trim()} onClick={focusText}>
      {files && <ComposerFiles files={files} />}
      {children}
      {bar && (
        <div className="composer-bar" data-composer-space="true">
          {files && <AttachButton files={files} disabled={attachDisabled} />}
          <div className="composer-meta" data-composer-space="true">
            {meta}
          </div>
          {action}
        </div>
      )}
    </div>
  );
}
