import React from 'react';
import { Badge } from '../../../../components/ui/Badge.jsx';
import { Button } from '../../../../components/ui/Button.jsx';
import { Icon } from '../../../../components/ui/Icon.jsx';
import { avatarTone, initials } from '../../profile/profileModel.js';
import { STATUS_TONES } from './websiteTeamModel.js';

/** Shared parts of one Team row, used by the desktop table and the phone cards. */
export function TeamPerson({ row, heading: Heading = 'strong', t }) {
  return (
    <div className="team-member-identity wt-person">
      <span className="team-member-avatar" data-tone={avatarTone(row.member.id)} aria-hidden="true">
        {initials(row.member.name)}
      </span>
      <div className="team-member-identity-text">
        <Heading className="wt-name">{row.member.name}</Heading>
        <span className="wt-muted">
          {t(row.admin ? 'websiteTeam.role.admin' : 'websiteTeam.role.staff')}
        </span>
      </div>
    </div>
  );
}

export function TeamProfile({ row, t }) {
  const body = row.profile?.body;
  return (
    <div className="wt-stack">
      <Badge tone={STATUS_TONES[row.status]}>{t(`websiteTeam.status.${row.status}`)}</Badge>
      {body && <span className="wt-muted">{[body.name, body.specialty].join(' · ')}</span>}
      {!row.eligible && <span className="wt-muted">{t('websiteTeam.needsProperties')}</span>}
    </div>
  );
}

export function TeamConsent({ row, actions, t }) {
  const state = !row.profile ? 'none' : row.profile.consent ? 'given' : 'missing';
  return (
    <div className="wt-stack">
      <span className="wt-consent" data-state={state}>
        <Icon name={state === 'given' ? 'check' : 'clock'} size={14} />
        {t(`websiteTeam.consent.${state}`)}
      </span>
      {row.own && (
        <button type="button" className="wt-link" onClick={actions.myProfile}>
          {t('websiteTeam.consent.own')}
        </button>
      )}
    </div>
  );
}

export function TeamPublishing({ row, actions, t }) {
  if (row.admin) return <span className="wt-strong">{t('websiteTeam.publishing.admin')}</span>;
  const name = row.member.name;
  const allowed = Boolean(row.profile?.canPublish);
  const label = t(`websiteTeam.publishing.${allowed ? 'stop' : 'allow'}`);
  const noteId = `wt-publishing-${row.member.id}`;
  return (
    <div className="wt-stack">
      {row.profile && (
        <span>{t(`websiteTeam.publishing.${allowed ? 'allowed' : 'notAllowed'}`)}</span>
      )}
      <Button
        variant="light"
        disabled={actions.busy || !row.profile}
        aria-label={t('websiteTeam.action.for', { action: label, name })}
        aria-describedby={row.profile ? undefined : noteId}
        onClick={() => (allowed ? actions.stop(row) : actions.allow(row))}
      >
        {label}
      </Button>
      {!row.profile && (
        <span className="wt-muted" id={noteId}>
          {t('websiteTeam.publishing.needsProfile', { name })}
        </span>
      )}
    </div>
  );
}

export function TeamLive({ row, t }) {
  return <span className="wt-live">{t('websiteTeam.live', { count: row.live })}</span>;
}

export function TeamActions({ row, actions, t }) {
  const label = (key) => t(`websiteTeam.action.${key}`);
  const named = (key) => t('websiteTeam.action.for', { action: label(key), name: row.member.name });
  const edit = row.profile ? 'edit' : 'setUp';
  const visibility = row.profile?.active ? 'hide' : 'show';
  return (
    <div className="wt-actions">
      <Button
        variant="light"
        disabled={actions.busy || !row.eligible}
        aria-label={named(edit)}
        onClick={() => actions.edit(row)}
      >
        {label(edit)}
      </Button>
      {row.profile && (
        <Button
          variant="light"
          disabled={actions.busy}
          aria-label={t(`websiteTeam.action.${visibility}Named`, { name: row.member.name })}
          onClick={() => actions[visibility](row)}
        >
          {label(visibility)}
        </Button>
      )}
    </div>
  );
}
