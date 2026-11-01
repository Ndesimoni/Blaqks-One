import React from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { useRecords, useWorkspaceActions } from '../../hooks/useWorkspace.js';
import { N } from '../../lib/format.js';
import { directoryNoun, plural } from './grid/directoryNouns.js';
import { RecordSort } from './RecordSort.jsx';
import { useRecordAccess } from './useRecordAccess.js';
import './grid/directory-toolbar.css';

/**
 * Directory heading slot: one authorized count (for screen readers; the grid's footer shows the
 * total) and the page's single primary action, which starts the toolbar row as in Bitrix24's
 * lists (approved mockup). The top bar owns the `h1`, so this repeats neither title nor
 * description (UI3, B-02).
 * `noun` and `onAdd` let a view of another collection (Leads over Clients) keep its own words.
 * `sortable={false}` drops the phone sort control for a presentation with a fixed order (the
 * Interaction log feed).
 */
export function RecordDirectoryHead({
  module,
  noun: nounProp,
  onAdd,
  accessModule = module,
  columnNames,
  sortable = true,
}) {
  const { data } = useRecords();
  const { add } = useWorkspaceActions();
  const can = useRecordAccess();
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
        {can(accessModule, 'create') && (
          <Button icon="plus" onClick={onAdd || (() => add(module))}>
            Add {noun}
          </Button>
        )}
      </div>
    </div>
  );
}
