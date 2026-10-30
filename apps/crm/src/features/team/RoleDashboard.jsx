import React from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { useSession } from '../../hooks/useSession.js';
import { useNavigation, useRecords } from '../../hooks/useWorkspace.js';

export function RoleDashboard() {
  const { user } = useSession();
  const { data } = useRecords();
  const { navigate } = useNavigation();
  const sections = [
    [
      'relationships',
      'Leads & clients',
      'Manage enquiries and relationships.',
      'Clients',
      'users',
      data.Clients.length,
    ],
    [
      'properties',
      'Property portfolio',
      'Browse your listings and shortlists.',
      'Properties',
      'building',
      data.Properties.length,
    ],
    [
      'schedule',
      'Your schedule',
      'Plan viewings, follow-ups and calls.',
      'Follow-ups',
      'calendar',
      data['Follow-ups'].length + data.Viewings.length,
    ],
    [
      'finance',
      'Deals & commissions',
      'Track transactions and financial records.',
      'Deals',
      'briefcase',
      data.Deals.length,
    ],
    ['reports', 'Insights & reports', 'Understand CRM performance.', 'CRM insights', 'chart', null],
  ];
  return (
    <div className="team-page">
      <section className="panel">
        <span className="team-preview-label">{user.role.toUpperCase()} WORKSPACE</span>
        <h2>Welcome, {user.name}</h2>
        <p className="team-muted">
          Your Super Admin assigned the sections and messaging channels available below.
        </p>
      </section>
      <div className="team-role-grid">
        {sections
          .filter(([key]) => user.permissions[key])
          .map(([key, label, detail, route, icon, count]) => (
            <section className="panel" key={key}>
              <Icon name={icon} size={24} />
              <h3>{label}</h3>
              <p className="team-muted">{detail}</p>
              {count !== null && <strong className="team-dashboard-count">{count} records</strong>}
              <Button variant="light" onClick={() => navigate(route)}>
                Open {label.toLowerCase()}
              </Button>
            </section>
          ))}
      </div>
      <section className="panel">
        <h3>Your account & messaging</h3>
        <p className="team-muted">
          Client WhatsApp: {user.channelAccess.whatsapp ? 'Allowed' : 'Not allowed'} · Client email:{' '}
          {user.channelAccess.email ? 'Allowed' : 'Not allowed'}. Sender accounts are not connected.
        </p>
        <Button variant="light" onClick={() => navigate('My profile')}>
          Open my profile
        </Button>
      </section>
    </div>
  );
}
