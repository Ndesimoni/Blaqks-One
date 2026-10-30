import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { FinanceDialog } from '../finance/FinanceDialog.jsx';
import { shareLink, whatsAppText, whatsAppUrl } from './shareModel.js';

/**
 * A sent share: the colleague finds it under "Shared with you", or opens the link, which
 * carries only the share's ID in the fragment. WhatsApp opens on this device with a message
 * naming only the sender, the type and the link — never the record's name or price.
 */
export function ShareSentDialog({ share, onClose }) {
  const { user } = useSession();
  const { t } = useI18n();
  const k = (key, vars) => t(`recordShares.${key}`, vars);
  const linkId = useId();
  const [copied, setCopied] = useState('');
  const name = share.to.name;
  const link = shareLink(window.location.origin, share.id);
  const message = whatsAppText(t, user.name, share.collection, link);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(k('copied'));
    } catch {
      setCopied(k('copyFailed'));
    }
  };
  return (
    <FinanceDialog
      eyebrow={k('dialogEyebrow')}
      title={k('sentTitle', { name })}
      intro={k('sentIntro', { name })}
      onClose={onClose}
      dismissLabel={k('done')}
      className="record-share-dialog"
    >
      <div className="field span-all">
        <label htmlFor={linkId}>{k('link')}</label>
        <input
          id={linkId}
          readOnly
          value={link}
          aria-describedby={`${linkId}-hint`}
          onFocus={(event) => event.target.select()}
        />
        <small id={`${linkId}-hint`} className="finance-hint">
          {k('linkHint', { name })}
        </small>
      </div>
      <div className="record-share-links">
        <Button variant="light" icon="copy" onClick={copy}>
          {k('copyLink')}
        </Button>
        <a
          className="btn btn-light"
          href={whatsAppUrl(message)}
          target="_blank"
          rel="noopener noreferrer"
          aria-describedby={`${linkId}-whatsapp`}
        >
          <Icon name="chat" size={16} />
          <span>{k('whatsAppButton')}</span>
        </a>
      </div>
      <small id={`${linkId}-whatsapp`} className="finance-hint">
        {k('whatsAppHint')}
      </small>
      <p className="record-share-done" role="status">
        {copied}
      </p>
    </FinanceDialog>
  );
}
