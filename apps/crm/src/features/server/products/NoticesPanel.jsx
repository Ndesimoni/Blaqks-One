import React, { useState } from 'react';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { ViewSwitch } from '../../../components/ui/ViewSwitch.jsx';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { NOTICE_TABS, rowsForTab } from './noticesModel.js';
import './notices.css';

/**
 * What is waiting for this person, in a narrow panel from the right edge (Bitrix24's
 * notifications slider): All, Mentions or Approvals; each row opens the page that handles it.
 */
export function NoticesPanel({ rows, onClose }) {
  const { t } = useI18n();
  const { navigate } = useNavigation();
  const [tab, setTab] = useState('all');
  const shown = rowsForTab(rows, tab);
  const open = (row) => {
    onClose();
    navigate(row.route);
  };
  return (
    <Drawer placement="right" className="notices-drawer" titleId="notices-title" onClose={onClose}>
      <div className="notices-panel">
        <div className="notices-head">
          <h2 id="notices-title">{t('frame.notifications')}</h2>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('frame.closeNotifications')}
            data-initial-focus
            onClick={onClose}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <ViewSwitch
          label={t('frame.noticeTabs')}
          options={NOTICE_TABS.map((key) => [key, t(`frame.tabs.${key}`)])}
          value={tab}
          onChange={setTab}
        />
        {shown.length ? (
          <ul className="notices-list">
            {shown.map((row) => (
              <li key={row.key}>
                <button type="button" className="notice" onClick={() => open(row)}>
                  <span className="notice-icon" aria-hidden="true">
                    <Icon name={row.icon} size={18} />
                  </span>
                  <span className="notice-text">
                    <strong>{t(`frame.notices.${row.key}`, { count: row.count })}</strong>
                    <span>{t(`frame.where.${row.key}`)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="notices-empty" role="status">
            <Icon name="bell" size={22} />
            <strong>{t('frame.caughtUp')}</strong>
            <p>{t(`frame.caughtUpDetail.${tab}`)}</p>
          </div>
        )}
      </div>
    </Drawer>
  );
}
