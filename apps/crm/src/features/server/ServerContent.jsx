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
import { independentScreen } from './independentScreens.jsx';
import { ServerActivity } from './activity/ServerActivity.jsx';
import { AssignmentPageScope } from './assignment/AssignmentPageScope.jsx';
import { ServerCalculators } from './calculators/ServerCalculators.jsx';
import { ServerClientDesk } from './clientDesk/ServerClientDesk.jsx';
import { ServerDashboard } from './dashboard/ServerDashboard.jsx';
import { ServerDateSearch } from './dateSearch/ServerDateSearch.jsx';
import { FinanceContent } from './finance/FinanceContent.jsx';
import { FollowUpsPage } from './followUps/FollowUpsPage.jsx';
import { ViewingsPage } from './viewings/ViewingsPage.jsx';
import { ServerGuide } from './guide/ServerGuide.jsx';
import { ServerInbox } from './inbox/ServerInbox.jsx';
import { ServerInsights } from './insights/ServerInsights.jsx';
import { ListingShareLinkPage } from './listingShares/ListingShareLinkPage.jsx';
import { LISTING_SHARE_ROUTE } from './listingShares/listingShareLinks.js';
import { ServerPerformance } from './performance/ServerPerformance.jsx';
import { isConnectedSection } from './sectionStatus.js';
import { ServerUnavailableSection } from './ServerUnavailableSection.jsx';
import { IncomingShares } from './shares/IncomingShares.jsx';
import { ShareLinkPage } from './shares/ShareLinkPage.jsx';
import { SHARE_ROUTE } from './shares/shareModel.js';
import { ServerWebsite } from './website/ServerWebsite.jsx';
import { websiteRoute } from './website/websiteRoutes.js';
import { StartPage } from './products/StartPage.jsx';

export function ServerContent({ owner }) {
  const { user } = useSession();
  const { route } = useNavigation();
  const { loading, error, retry } = useRecords();
  // `#/shares/{id}`: the server decides who may read the share (record sharing R1).
  if (route === SHARE_ROUTE) return <ShareLinkPage />;
  // `#/listing-shares/{id}`: a listing from another company (record sharing R2).
  if (route === LISTING_SHARE_ROUTE) return <ListingShareLinkPage />;
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
  if (route === 'Start') return <StartPage />;
  if (route === 'Team & access') return <ServerTeamPage owner={owner} />;
  // One element per site across its sections, so an unsaved content draft survives switching.
  const website = websiteRoute(route);
  if (website) {
    const platform = website.gate === 'platform';
    return (
      <ServerWebsite
        key={platform ? 'platform' : 'company'}
        platform={platform}
        section={website.section}
      />
    );
  }
  // Pages independent of the selected workspace's records (account, settings, messaging).
  const own = independentScreen(route, user);
  if (own) return own;
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
  const page = (toolbarExtras, selectionActions) => {
    if (route === 'Viewings') return <ViewingsPage toolbarExtras={toolbarExtras} />;
    if (route === 'Follow-ups') return <FollowUpsPage toolbarExtras={toolbarExtras} />;
    if (route === 'Leads')
      return <LeadsPage toolbarExtras={toolbarExtras} selectionActions={selectionActions} />;
    if (route === 'Contacts')
      return <ContactsPage toolbarExtras={toolbarExtras} selectionActions={selectionActions} />;
    if (route === 'Properties')
      return (
        <PropertyDirectory toolbarExtras={toolbarExtras} selectionActions={selectionActions} />
      );
    return (
      <RecordsPage
        module={route}
        toolbarExtras={toolbarExtras}
        selectionActions={selectionActions}
      />
    );
  };
  const collection = route === 'Leads' ? 'Clients' : route;
  // Records a colleague shared with the caller wait above Leads, Clients, Properties and
  // Contacts; other pages show nothing there.
  return (
    <AssignmentPageScope key={route} module={collection}>
      {(toolbarExtras, selectionActions) => (
        <>
          <IncomingShares collection={collection} />
          {page(toolbarExtras, selectionActions)}
        </>
      )}
    </AssignmentPageScope>
  );
}
