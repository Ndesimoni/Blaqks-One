import React, { useId } from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import './insights-feed.css';

/**
 * The approved mockup's insights feed: what stands out in the records, each line opening the
 * list it is about. `items` are `{ key, icon, title, text, when, route }`, already limited to
 * the lists the member may open.
 */
export function InsightsFeed({ items }) {
  const { t } = useI18n();
  const { navigate } = useNavigation();
  const headingId = useId();
  if (!items.length) return null;
  return (
    <section className="insights-feed" aria-labelledby={headingId}>
      <h2 id={headingId} className="dashboard-section-title">
        {t('insights.feed')}
      </h2>
      <ul className="insights-feed-list">
        {items.map((item) => (
          <li key={item.key}>
            <button type="button" className="insight-event" onClick={() => navigate(item.route)}>
              <span className="insight-dot" aria-hidden="true">
                <Icon name={item.icon} size={17} />
              </span>
              <span className="insight-body">
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </span>
              <time className="insight-when">{item.when}</time>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
