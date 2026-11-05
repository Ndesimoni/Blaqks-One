import React, { useState } from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { badge } from '../chat/chatModel.js';
import { NoticesPanel } from './NoticesPanel.jsx';
import { noticeTotal } from './noticesModel.js';
import { useNotices } from './useNotices.js';

/**
 * The top bar's bell (NAV5): the number of things waiting for this person, opening the
 * notifications panel. Its name carries the count, as the messenger buttons' names do.
 */
export function NotificationBell() {
  const { t } = useI18n();
  const rows = useNotices();
  const total = noticeTotal(rows);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="icon-btn header-message header-bell"
        aria-label={total ? t('frame.bellWaiting', { count: total }) : t('frame.bell')}
        onClick={() => setOpen(true)}
      >
        <Icon name="bell" size={20} />
        {total > 0 && <span className="header-badge">{badge(total)}</span>}
      </button>
      {open && <NoticesPanel rows={rows} onClose={() => setOpen(false)} />}
    </>
  );
}
