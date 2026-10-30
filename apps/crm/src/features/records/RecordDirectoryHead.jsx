import React from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { useRecords, useWorkspaceActions } from '../../hooks/useWorkspace.js';
import { N } from '../../lib/format.js';
import { RecordSort } from './RecordSort.jsx';
import { useRecordAccess } from './useRecordAccess.js';

/** One noun per collection: the record word used by the count and the primary action. */
const nouns = {
  Clients: 'client',
  Contacts: 'contact',
  Deals: 'deal',
  'Follow-ups': 'follow-up',
  Viewings: 'viewing',
  'Client care': 'touchpoint',
  'Interaction log': 'conversation',
  Payments: 'payment',
  Expenses: 'expense',
  Shortlist: 'match',
};

function plural(noun) {
  return /s$/.test(noun) ? noun : `${noun}s`;
}

/**
 * Directory heading slot: one authorized count and the page's single primary action. The shell
 * still owns the `h1`, so this repeats neither the title nor its description (UI3, B-02).
 * `noun` and `onAdd` let a view of another collection (Leads over Clients) keep its own words.
 */
export function RecordDirectoryHead({
  module,
  noun: nounProp,
  onAdd,
  accessModule = module,
  columnNames,
}) {
  const { data } = useRecords();
  const { add } = useWorkspaceActions();
  const can = useRecordAccess();
  const count = data[module]?.length || 0;
  const noun = nounProp || nouns[module] || 'record';
  return (
    <div className="record-directory-head">
      <p className="record-count">
        <span className="record-count-number">{N(count)}</span>
        <span className="record-count-word">{count === 1 ? noun : plural(noun)}</span>
      </p>
      <div className="record-directory-actions">
        <RecordSort module={module} columnNames={columnNames} />
        {can(accessModule, 'create') && (
          <Button icon="plus" onClick={onAdd || (() => add(module))}>
            Add {noun}
          </Button>
        )}
      </div>
    </div>
  );
}
