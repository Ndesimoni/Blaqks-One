import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { TABS } from './inboxModel.js';

/**
 * Mine, Unassigned, Team and Spam across the top of the Client inbox, as the approved
 * mockup's header tabs (Bitrix24); Mine and Unassigned carry their counts. On phones they show
 * with the list only, so an open conversation keeps the whole screen.
 */
export function InboxTabs({ view, summary, pane }) {
  const { t } = useI18n();
  const counts = { mine: summary.mine, unassigned: summary.unassigned };
  return (
    <div
      role="tablist"
      aria-label={t('inbox.list.views')}
      className={`inbox-tabs inbox-top-tabs is-${pane}`}
    >
      {TABS.map((name) => (
        <button
          key={name}
          type="button"
          role="tab"
          aria-selected={view.tab === name}
          className={'inbox-tab' + (view.tab === name ? ' is-active' : '')}
          onClick={() => view.setTab(name)}
        >
          {t(`inbox.tab.${name}`)}
          {counts[name] > 0 && (
            <span className="inbox-tab-count">{counts[name] > 99 ? '99+' : counts[name]}</span>
          )}
        </button>
      ))}
    </div>
  );
}
