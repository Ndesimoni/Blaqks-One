import React, { useId } from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { TitleSection } from '../../../components/ui/TitleSection.jsx';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { N } from '../../../lib/format.js';

/**
 * A dashboard bar chart (dataviz: magnitude in one hue, thin bars from one baseline, the value
 * at the tip): each row names its part and count, so no colour carries meaning and the list is
 * its own table view. Each bar's tooltip adds its share. `link` opens the related page.
 */
export function LeadBars({ heading, caption, rows, empty, link }) {
  const { navigate } = useNavigation();
  const headingId = useId();
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <section className="panel lead-bars" aria-labelledby={headingId}>
      <TitleSection heading={<span id={headingId}>{heading}</span>} caption={caption} />
      {rows.length ? (
        <ul className="lead-bars-list">
          {rows.map((row) => (
            <li
              key={row.name}
              className="bar-row"
              title={`${row.name}: ${N(row.count)} (${Math.round((row.count / total) * 100)}%)`}
            >
              <span className="bar-label">
                <span>{row.name}</span>
                <strong>{N(row.count)}</strong>
              </span>
              <span className="lead-bar" style={{ width: `${(row.count / max) * 100}%` }} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{empty}</p>
      )}
      {link && (
        <button type="button" className="panel-link" onClick={() => navigate(link.route)}>
          {link.label} <Icon name="arrow" size={16} />
        </button>
      )}
    </section>
  );
}
