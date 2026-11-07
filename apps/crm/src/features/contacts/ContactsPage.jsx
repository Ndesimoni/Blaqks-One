import React from 'react';
import { RecordsPage } from '../records/RecordsPage.jsx';
import { contactTabs, matchesContactTab } from './selectors.js';

export function ContactsPage({ toolbarExtras = null, selectionActions = null }) {
  return (
    <div className="contacts-page">
      <RecordsPage
        module="Contacts"
        tabs={contactTabs}
        matchesTab={matchesContactTab}
        emptyDetail="Try another search or choose All contacts to show every contact."
        toolbarExtras={toolbarExtras}
        selectionActions={selectionActions}
      />
    </div>
  );
}
