import React from 'react';
import { useSession } from '../../hooks/useSession.js';
import { useRecords, useNavigation } from '../../hooks/useWorkspace.js';
import { Button } from '../../components/ui/Button.jsx';
import { RecordsPage } from '../records/RecordsPage.jsx';
import { ContactsPage } from '../contacts/ContactsPage.jsx';
import { LeadsPage } from '../leads/LeadsPage.jsx';
import { PropertyDirectory } from '../properties/PropertyDirectory.jsx';
import { ServerTeamPage } from '../server-team/ServerTeamPage.jsx';
import { canOpenSection } from './access.js';
import { isConnectedSection } from './sectionStatus.js';
import { ServerUnavailableSection } from './ServerUnavailableSection.jsx';
import { AssignmentPageScope } from './assignment/AssignmentPageScope.jsx';
import { ServerDashboard } from './dashboard/ServerDashboard.jsx';
import { ServerClientDesk } from './clientDesk/ServerClientDesk.jsx';
import { FinanceContent } from './finance/FinanceContent.jsx';

export function ServerContent({ owner }) {
  const { user } = useSession();
  const { route } = useNavigation();
  const { loading, error, retry } = useRecords();
  if (!canOpenSection(user, route))
    return (
      <section className="panel recovery-panel">
        <h2>{route === 'Page not found' ? 'Your workspace is ready' : 'Access is restricted'}</h2>
        <p>
          Your assigned access determines which connected sections you can open. Contact your team
          Admin to adjust your permissions.
        </p>
        <p>Reports and messaging connections are still being developed.</p>
      </section>
    );
  if (route === 'Team & access') return <ServerTeamPage owner={owner} />;
  if (!isConnectedSection(route)) return <ServerUnavailableSection route={route} owner={owner} />;
  if (loading) return <p role="status">Loading workspace records…</p>;
  if (error)
    return (
      <section className="panel recovery-panel">
        <p className="field-error" role="alert">
          {error}
        </p>
        <Button onClick={retry}>Retry</Button>
      </section>
    );
  if (route === 'Dashboard') return <ServerDashboard owner={owner} />;
  if (route === 'Client desk') return <ServerClientDesk />;
  if (['Deals', 'Payments', 'Expenses'].includes(route))
    return <FinanceContent key={route} route={route} owner={owner} />;
  const page = (toolbarExtras) => {
    if (route === 'Leads') return <LeadsPage toolbarExtras={toolbarExtras} />;
    if (route === 'Contacts') return <ContactsPage toolbarExtras={toolbarExtras} />;
    if (route === 'Properties') return <PropertyDirectory toolbarExtras={toolbarExtras} />;
    return <RecordsPage module={route} toolbarExtras={toolbarExtras} />;
  };
  return (
    <AssignmentPageScope key={route} module={route === 'Leads' ? 'Clients' : route}>
      {page}
    </AssignmentPageScope>
  );
}
