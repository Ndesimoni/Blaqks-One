import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { FinanceDialog } from '../finance/FinanceDialog.jsx';
import { whatsAppUrl } from '../shares/shareModel.js';
import { listingShareLink, listingWhatsAppText } from './listingShareLinks.js';

/**
 * A sent listing share: the agent finds it in Agreements → Listings, or opens the link,
 * which carries only the share's ID and opens only for them, signed in. WhatsApp opens on
 * this device with a message naming only the sender and the link: no title, price or area.
 */
export function OutsideShareSent({ share, onClose }) {
  const { user } = useSession();
  const { t } = useI18n();
  const k = (key, vars) => t(`listingShares.${key}`, vars);
  const linkId = useId();
  const [copied, setCopied] = useState('');
  const name = share.to.name || k('someone');
  const link = listingShareLink(window.location.origin, share.id);
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
      intro={k('sentIntro', { name, reference: share.reference })}
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
          href={whatsAppUrl(listingWhatsAppText(t, user.name, link))}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="chat" size={16} />
          <span>{k('whatsAppButton')}</span>
        </a>
      </div>
      <p className="record-share-done" role="status">
        {copied}
      </p>
    </FinanceDialog>
  );
}
