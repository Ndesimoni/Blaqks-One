import React from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { useSession } from '../../hooks/useSession.js';
import { useNavigation, useRecords } from '../../hooks/useWorkspace.js';
import { ContactsPage } from '../contacts/ContactsPage.jsx';
import { LeadsPage } from '../leads/LeadsPage.jsx';
import { PropertyDirectory } from '../properties/PropertyDirectory.jsx';
import { RecordsPage } from '../records/RecordsPage.jsx';
import { ServerTeamPage } from '../server-team/ServerTeamPage.jsx';
import { canOpenSection } from './access.js';
import { ServerActivity } from './activity/ServerActivity.jsx';
import { ServerAgreements } from './agreements/ServerAgreements.jsx';
import { AssignmentPageScope } from './assignment/AssignmentPageScope.jsx';
import { ServerCalculators } from './calculators/ServerCalculators.jsx';
import { ServerChannels } from './channels/ServerChannels.jsx';
import { ServerClientDesk } from './clientDesk/ServerClientDesk.jsx';
import { ServerDashboard } from './dashboard/ServerDashboard.jsx';
import { ServerDateSearch } from './dateSearch/ServerDateSearch.jsx';
import { FinanceContent } from './finance/FinanceContent.jsx';
import { ServerGuide } from './guide/ServerGuide.jsx';
import { ServerInbox } from './inbox/ServerInbox.jsx';
import { ServerInboxRules } from './inboxRules/ServerInboxRules.jsx';
import { ServerTeamChat } from './chat/ServerTeamChat.jsx';
import { GoogleReturn } from './mailbox/GoogleReturn.jsx';
import { ServerMailbox } from './mailbox/ServerMailbox.jsx';
import { ServerInsights } from './insights/ServerInsights.jsx';
import { ServerPerformance } from './performance/ServerPerformance.jsx';
import { ServerProfile } from './profile/ServerProfile.jsx';
import { isConnectedSection } from './sectionStatus.js';
import { ServerUnavailableSection } from './ServerUnavailableSection.jsx';
import { IncomingShares } from './shares/IncomingShares.jsx';
import { ShareLinkPage } from './shares/ShareLinkPage.jsx';
import { SHARE_ROUTE } from './shares/shareModel.js';

export function ServerContent({ owner }) {
  const { user } = useSession();
  const { route } = useNavigation();
  const { loading, error, retry } = useRecords();
  // `#/shares/{id}`: the server decides who may read the share (record sharing R1).
  if (route === SHARE_ROUTE) return <ShareLinkPage />;
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
  // The member's own account: independent of the selected workspace's records.
  if (route === 'My profile') return <ServerProfile />;
  if (route === 'Channels') return <ServerChannels />;
  if (route === 'Inbox rules') return <ServerInboxRules />;
  if (route === 'Team chat') return <ServerTeamChat />;
  if (route === 'Agreements') return <ServerAgreements />;
  if (route === 'My mailbox') return <ServerMailbox />;
  if (route === 'Google sign-in') return <GoogleReturn />;
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
  if (route === 'Performance') return <ServerPerformance owner={owner} />;
  if (route === 'CRM insights') return <ServerInsights owner={owner} />;
  if (route === 'Date search') return <ServerDateSearch owner={owner} />;
  if (route === 'Guide') return <ServerGuide />;
  if (route === 'Calculators') return <ServerCalculators />;
  if (route === 'Team activity') return <ServerActivity owner={owner} />;
  if (route === 'Inbox') return <ServerInbox owner={owner} />;
  if (['Deals', 'Payments', 'Expenses'].includes(route))
    return <FinanceContent key={route} route={route} owner={owner} />;
  const page = (toolbarExtras) => {
    if (route === 'Leads') return <LeadsPage toolbarExtras={toolbarExtras} />;
    if (route === 'Contacts') return <ContactsPage toolbarExtras={toolbarExtras} />;
    if (route === 'Properties') return <PropertyDirectory toolbarExtras={toolbarExtras} />;
    return <RecordsPage module={route} toolbarExtras={toolbarExtras} />;
  };
  const collection = route === 'Leads' ? 'Clients' : route;
  // Records a colleague shared with the caller wait above Leads, Clients, Properties and
  // Contacts; other pages show nothing there.
  return (
    <AssignmentPageScope key={route} module={collection}>
      {(toolbarExtras) => (
        <>
          <IncomingShares collection={collection} />
          {page(toolbarExtras)}
        </>
      )}
    </AssignmentPageScope>
  );
}
