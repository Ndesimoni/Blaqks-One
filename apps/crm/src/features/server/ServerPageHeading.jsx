import React from 'react';
import { labels } from '../../config/navigation.js';
import { useSession } from '../../hooks/useSession.js';
import { useNavigation } from '../../hooks/useWorkspace.js';
import { useI18n } from '../../i18n/useI18n.js';
import { ServerImportAction } from './ServerImportAction.jsx';
import { ViewOnlyChip } from './ViewOnlyChip.jsx';
import { activityLabel } from './access.js';
import { isRecordSection, sectionDescription } from './sectionStatus.js';

const translated = {
  Inbox: 'inbox',
  'Team chat': 'chat',
  Channels: 'channels',
  'Inbox rules': 'inboxRules',
  'My mailbox': 'mailbox',
  'Google sign-in': 'mailbox',
  Agreements: 'agreements',
  'Shared record': 'recordShares',
  Website: 'websites',
  'Platform website': 'websites',
};

/** Shared heading and scoped record actions; independent tools keep their own page content. */
export function ServerPageHeading({ owner, workspaces }) {
  const { user } = useSession();
  const { route } = useNavigation();
  const { t } = useI18n();
  const supported = isRecordSection(route);
  const team = route === 'Team & access';
  const title = route === 'Team activity' ? activityLabel(user) : route;
  const platform = route === 'Platform website';
  const name = team
    ? 'Team'
    : translated[title]
      ? t(`${translated[title]}.${platform ? 'platformTitle' : 'title'}`)
      : title === 'My profile'
        ? 'My profile'
        : labels[title] || title || 'Your CRM workspace';
  const description = team
    ? owner.status === 'archived'
      ? 'Review saved accounts and access history.'
      : 'Manage people and access within this workspace.'
    : translated[title]
      ? t(`${translated[title]}.${platform ? 'platformDescription' : 'description'}`)
      : sectionDescription(title);
  return (
    <div className="page-heading">
      <div className="heading-left">
        <h1>{name}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">
        {supported && <ViewOnlyChip module={route} />}
        {(supported || team) && <ServerImportAction owner={owner} workspaces={workspaces} />}
      </div>
    </div>
  );
}
