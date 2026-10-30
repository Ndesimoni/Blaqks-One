import React from 'react';
import { COLORS } from '../../config/theme.js';
import { TitleSection } from '../../components/ui/TitleSection.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { useNavigation } from '../../hooks/useWorkspace.js';

/** Dashboard panel of labelled bars; `link` adds a footer action to a related page. */
export function BarListPanel({ heading, caption, rows, max, colorOffset = 0, empty, link }) {
  const { navigate } = useNavigation();
  return (
    <section className="panel">
      <TitleSection heading={heading} caption={caption} />
      <div className="pipeline-list">
        {rows.map((row, i) => (
          <div className="bar-row" key={row.name}>
            <div className="bar-label">
              <span>{row.name}</span>
              <strong>{row.count}</strong>
            </div>
            <div className="bar-track">
              <div
                style={{
                  width: (row.count / Math.max(1, max)) * 100 + '%',
                  background: COLORS[(i + colorOffset) % COLORS.length],
                }}
              />
            </div>
          </div>
        ))}
        {!rows.length && empty && <span className="muted">{empty}</span>}
      </div>
      {link && (
        <button className="panel-link" onClick={() => navigate(link.route)}>
          {link.label} <Icon name="arrow" size={16} />
        </button>
      )}
    </section>
  );
}
