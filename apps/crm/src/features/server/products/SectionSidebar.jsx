import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { TeamChatNavItem } from '../chat/TeamChatNavItem.jsx';
import { navIcons } from '../connectedNav.js';
import { InboxNavItem } from '../inbox/InboxNavItem.jsx';
import { ServerNavigationItem } from '../ServerNavigationItem.jsx';
import { waitingSources } from '../waitingCounts.js';
import { WaitingNavItem } from '../WaitingNavItem.jsx';
import { productSections } from './productModel.js';

/** One section: it keeps the badge of its first route (shares, hand-overs, unread). */
function SectionEntry({ section, label, active, route, onSelect }) {
  const first = section.routes[0];
  const props = { route, onSelect, active, label };
  // Inbox and Team chat keep their own names and unread badges.
  if (first === 'Inbox') return <InboxNavItem {...props} label={undefined} />;
  if (first === 'Team chat') return <TeamChatNavItem {...props} label={undefined} />;
  if (waitingSources[first])
    return <WaitingNavItem name={first} icon={navIcons[first]} {...props} />;
  return <ServerNavigationItem name={first} icon={navIcons[first]} {...props} />;
}

/**
 * The contextual sidebar (NAV): only the current product's sections. A section opens on the
 * route already open in it, else on its first route; the routes themselves are header tabs.
 */
export function SectionSidebar({ user, product, company, here, route, navigate }) {
  const { t } = useI18n();
  const title = t(`products.${product}`);
  const sections = productSections(user, product);
  const entry = (section) => (
    <SectionEntry
      key={section.key}
      section={section}
      label={t(`products.sections.${section.key}`)}
      active={here?.section.key === section.key}
      route={route}
      onSelect={() => navigate(section.routes.includes(route) ? route : section.routes[0])}
    />
  );
  const personal = sections.filter((section) => section.personal);
  return (
    <aside id="section-sidebar" className="sidebar section-sidebar">
      <h2 className="section-sidebar-title">{title}</h2>
      {company && <p className="section-sidebar-company">{company}</p>}
      <nav className="nav-groups" aria-label={t('products.sectionsOf', { product: title })}>
        <div className="nav-group">
          {sections.filter((section) => !section.personal).map(entry)}
        </div>
        {personal.length > 0 && (
          <div className="nav-group nav-group-pinned">
            <div className="nav-label">{t('products.personal')}</div>
            {personal.map(entry)}
          </div>
        )}
      </nav>
    </aside>
  );
}
