import React, { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { routes } from '../config/routes.js';
import { MODS } from '../lib/schema.js';
import { Button } from '../components/ui/Button.jsx';
import { useNavigation } from '../hooks/useWorkspace.js';
import { useSession } from '../hooks/useSession.js';
import { useTeam } from '../hooks/useTeam.js';
import { canVisit } from '../features/team/model.js';

const page = (loader, name) => lazy(() => loader().then((module) => ({ default: module[name] })));
const screens = {
  Workspaces: page(() => import('../features/workspaces/WorkspacesPage.jsx'), 'WorkspacesPage'),
  'Team activity': page(
    () => import('../features/activity/TeamActivityPage.jsx'),
    'TeamActivityPage',
  ),
  Messages: page(() => import('../features/messaging/MessagesPage.jsx'), 'MessagesPage'),
  'Team & access': page(() => import('../features/team/TeamPage.jsx'), 'TeamPage'),
  'My profile': page(() => import('../features/team/ProfilePage.jsx'), 'ProfilePage'),
  Dashboard: page(() => import('../features/dashboard/DashboardPage.jsx'), 'DashboardPage'),
  'CRM insights': page(() => import('../features/insights/InsightsPage.jsx'), 'InsightsPage'),
  'Client desk': page(() => import('../features/clients/ClientDeskPage.jsx'), 'ClientDeskPage'),
  Leads: page(() => import('../features/leads/LeadsPage.jsx'), 'LeadsPage'),
  Contacts: page(() => import('../features/contacts/ContactsPage.jsx'), 'ContactsPage'),
  'Date search': page(() => import('../features/reports/DateSearchPage.jsx'), 'DateSearchPage'),
  Performance: page(() => import('../features/reports/PerformancePage.jsx'), 'PerformancePage'),
  Guide: page(() => import('../features/guide/GuidePage.jsx'), 'GuidePage'),
  Properties: page(
    () => import('../features/properties/PropertyDirectory.jsx'),
    'PropertyDirectory',
  ),
};
const RecordsPage = page(() => import('../features/records/RecordsPage.jsx'), 'RecordsPage');
const RoleDashboard = page(() => import('../features/team/RoleDashboard.jsx'), 'RoleDashboard');

function SectionAccess({ name, children }) {
  const { user } = useSession();
  const { team } = useTeam();
  const { navigate } = useNavigation();
  if (!canVisit(user, name) && !(name === 'Team & access' && !team.configured))
    return (
      <section className="panel team-flow-message">
        <h2>This section is outside your assigned access</h2>
        <p>Ask your Super Admin to update your role if you need this section.</p>
        <Button variant="light" onClick={() => navigate('Dashboard')}>
          Back to overview
        </Button>
      </section>
    );
  if (name === 'Dashboard' && !Object.values(user.permissions).every(Boolean))
    return <RoleDashboard />;
  return children;
}

function NotFound() {
  const { navigate } = useNavigation();
  return (
    <div className="empty">
      <h2>Page not found</h2>
      <p>Choose a CRM section from the navigation.</p>
      <Button onClick={() => navigate('Dashboard')}>Back to overview</Button>
    </div>
  );
}

export function FeatureRoutes() {
  return (
    <Suspense
      fallback={
        <div className="empty" role="status">
          Loading workspace…
        </div>
      }
    >
      <Routes>
        <Route path="/calendar" element={<Navigate to="/" replace />} />
        {routes.map(({ name, path }) => {
          const Screen = screens[name];
          return (
            <Route
              key={name}
              path={path}
              element={
                <SectionAccess name={name}>
                  {Screen ? (
                    <Screen />
                  ) : MODS[name] ? (
                    <RecordsPage key={name} module={name} />
                  ) : (
                    <NotFound />
                  )}
                </SectionAccess>
              }
            />
          );
        })}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
