import React, { useId } from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { ACCEPT } from '../chat/useAttachments.js';

/**
 * The composer's "+": a label around the native file input, so the input keeps its name
 * (Attach files), keyboard access and file picker; the limits are its description.
 */
export function AttachButton({ files, disabled }) {
  const { t } = useI18n();
  const hintId = useId();
  const off = disabled || files.full;
  const hint = files.full ? t('chat.files.full') : t('chat.files.limits');
  return (
    <>
      <label className={'composer-attach' + (off ? ' is-disabled' : '')} title={hint}>
        <input
          type="file"
          className="sr-only"
          accept={ACCEPT}
          multiple
          disabled={off}
          aria-label={t('chat.files.add')}
          aria-describedby={hintId}
          onChange={(event) => {
            files.add(event.target.files);
            event.target.value = '';
          }}
        />
        <Icon name="plus" size={20} strokeWidth={2} />
      </label>
      <span id={hintId} className="sr-only">
        {hint}
      </span>
    </>
  );
}

/**
 * The "+" where files cannot go yet (WhatsApp until its media packet): it stays in place,
 * disabled, and says why in its tooltip and description.
 */
export function AttachOff({ reason }) {
  const { t } = useI18n();
  const hintId = useId();
  return (
    <>
      <button
        type="button"
        className="composer-attach is-disabled"
        aria-disabled="true"
        aria-label={t('chat.files.add')}
        aria-describedby={hintId}
        title={reason}
      >
        <Icon name="plus" size={20} strokeWidth={2} />
      </button>
      <span id={hintId} className="sr-only">
        {reason}
      </span>
    </>
  );
}
