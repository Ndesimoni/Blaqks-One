import React, { useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { MarketplaceBoard } from './MarketplaceBoard.jsx';
import { MarketplaceRequests } from './MarketplaceRequests.jsx';

const TABS = ['board', 'mine'];

/** Board and My requests, below the member's own profile (packet MK2). */
export function MarketplaceRequestTabs() {
  const { t } = useI18n();
  const [tab, setTab] = useState('board');
  return (
    <section className="market-card">
      <div className="market-tabs" role="tablist" aria-label={t('marketplaceRequests.board.title')}>
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`market-tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`market-panel-${key}`}
            className={tab === key ? 'market-tab is-active' : 'market-tab'}
            onClick={() => setTab(key)}
          >
            {t(`marketplaceRequests.tabs.${key}`)}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`market-panel-${tab}`}
        aria-labelledby={`market-tab-${tab}`}
        className="market-panel"
      >
        {tab === 'board' ? <MarketplaceBoard /> : <MarketplaceRequests />}
      </div>
    </section>
  );
}
