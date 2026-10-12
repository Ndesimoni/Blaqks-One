import React from 'react';
import { RecordsPage } from '../records/RecordsPage.jsx';
import { contactTabs, matchesContactTab } from './selectors.js';

export function ContactsPage({ toolbarExtras = null }) {
  return (
    <div className="contacts-page">
      <RecordsPage
        module="Contacts"
        tabs={contactTabs}
        matchesTab={matchesContactTab}
        emptyDetail="Try another search or choose All to show every contact."
        toolbarExtras={toolbarExtras}
      />
    </div>
  );
}
