import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { activityLabel } from '../access.js';
import { navLabel } from '../connectedNav.js';
import { websiteRoute } from '../website/websiteRoutes.js';

/**
 * Header tabs (NAV): the routes of the current section, shown when it has more than one.
 * Each tab is an existing route with its own address, so this is navigation, not a tablist.
 */
export function SectionTabs({ user, section, route, navigate }) {
  const { t } = useI18n();
  if (!section || section.routes.length < 2) return null;
  return (
    <nav className="section-tabs" aria-label={t('products.tabs')}>
      {section.routes.map((name) => (
        <button
          type="button"
          key={name}
          className={name === route ? 'active' : undefined}
          aria-current={name === route ? 'page' : undefined}
          onClick={() => navigate(name)}
        >
          {name === 'Team activity'
            ? activityLabel(user)
            : websiteRoute(name)?.tab
              ? t(websiteRoute(name).tab)
              : name === 'Clients'
                ? t('products.tabs.allClients')
                : navLabel(user, name)}
        </button>
      ))}
    </nav>
  );
}
