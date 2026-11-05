import React from 'react';
import { nav } from '../../../config/navigation.js';
import { TitleSection } from '../../../components/ui/TitleSection.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { N } from '../../../lib/format.js';
import './dashboard.css';

const icons = Object.fromEntries(nav.flatMap((group) => group.items));

/**
 * Record totals for each connected collection the member may open, with a link to each list.
 * The figure sits right-aligned so totals scan as a column; empty lists are quieter.
 */
export function RecordCountsPanel({ collections, counts, caption }) {
  const { navigate } = useNavigation();
  return (
    <section className="panel activity-panel" aria-label="Records in view">
      <TitleSection heading="Records in view" caption={caption} />
      <div className="todo-list record-counts">
        {collections.map((name) => (
          <button
            type="button"
            className="todo-row record-count-row"
            key={name}
            data-empty={counts[name] ? undefined : true}
            aria-label={`${name}: ${counts[name]} ${counts[name] === 1 ? 'record' : 'records'}`}
            onClick={() => navigate(name)}
          >
            <span className="todo-indicator">
              <Icon name={icons[name] || 'note'} size={16} />
            </span>
            <strong>{name}</strong>
            <span className="record-count-value">{N(counts[name])}</span>
            <Icon name="chevron" size={16} />
          </button>
        ))}
      </div>
    </section>
  );
}
