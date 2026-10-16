import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { N } from '../../../lib/format.js';
import { DashSection } from './DashSection.jsx';
import './records-in-view.css';

/**
 * Record totals for each connected collection the member may open, each row opening its list.
 * Totals align as a column; empty lists are quieter.
 */
export function RecordsInView({ collections, counts, className, style }) {
  const { navigate } = useNavigation();
  return (
    <DashSection
      className={className}
      style={style}
      label="Records in view"
      caption="Open a list to review or update these records"
    >
      <ul className="records-in-view">
        {collections.map((name) => (
          <li key={name}>
            <button
              type="button"
              className="records-row"
              data-empty={counts[name] ? undefined : true}
              aria-label={`${name}: ${counts[name]} ${counts[name] === 1 ? 'record' : 'records'}`}
              onClick={() => navigate(name)}
            >
              <span>{name}</span>
              <strong>{N(counts[name])}</strong>
              <Icon name="chevron" size={16} />
            </button>
          </li>
        ))}
      </ul>
    </DashSection>
  );
}
