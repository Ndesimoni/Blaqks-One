import React, { useRef } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { ChosenFiles } from '../chat/ChosenFiles.jsx';
import { ACCEPT } from '../chat/useAttachments.js';

/**
 * Email attachments (F3a): photos and PDFs chosen for one email, each uploaded at once as
 * the member's private pending upload, reusing team chat's chooser. Company email only.
 */
export function AttachFiles({ files, disabled }) {
  const { t } = useI18n();
  const picker = useRef(null);
  return (
    <div className="inbox-attach">
      <ChosenFiles files={files} />
      <input
        ref={picker}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        aria-label={t('inboxSend.files.attach')}
        onChange={(event) => {
          files.add(event.target.files);
          event.target.value = '';
        }}
      />
      <Button
        variant="light"
        icon="image"
        disabled={disabled || files.full}
        onClick={() => picker.current?.click()}
      >
        {t('inboxSend.files.attach')}
      </Button>
      <small className="inbox-attach-hint">{t('inboxSend.files.hint')}</small>
    </div>
  );
}
