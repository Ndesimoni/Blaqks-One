import React from 'react';
import { useRecords } from '../../hooks/useWorkspace.js';
import { N } from '../../lib/format.js';
import { directoryNoun, plural } from './grid/directoryNouns.js';
import { RecordSort } from './RecordSort.jsx';
import './grid/directory-toolbar.css';

/**
 * Directory heading slot: one authorized count, kept for screen readers (the grid's footer
 * shows the total), and the phone sort control. Records are added from the top bar's Create,
 * as in the approved mockup, so lists carry no Add button. The top bar owns the `h1`.
 * `noun` lets a view of another collection (Leads over Clients) keep its own words.
 * `sortable={false}` drops the phone sort control for a presentation with a fixed order (the
 * Interaction log feed).
 */
export function RecordDirectoryHead({ module, noun: nounProp, columnNames, sortable = true }) {
  const { data } = useRecords();
  const count = data[module]?.length || 0;
  const noun = nounProp || directoryNoun(module);
  return (
    <div className="record-directory-head">
      <p className="record-count">
        <span className="record-count-number">{N(count)}</span>
        <span className="record-count-word">{count === 1 ? noun : plural(noun)}</span>
      </p>
      <div className="record-directory-actions">
        {sortable && <RecordSort module={module} columnNames={columnNames} />}
      </div>
    </div>
  );
}
