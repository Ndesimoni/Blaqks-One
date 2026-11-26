import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';

const QUESTIONS = { signOut: 'confirmSignOut', reset: 'confirmReset', archive: 'confirmArchive' };

/**
 * The Owner's account controls for one team member (owner, 2026-11-05): Resend link while
 * invited; Sign out everywhere and Reset password once joined; Archive. Each that cuts the
 * person off is confirmed in place first. The Owner never sees a password.
 */
export function StaffAccountControls({ member, busy, run }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`platformTeam.${key}`, vars);
  const [asking, setAsking] = useState('');
  if (asking)
    return (
      <div className="platform-staff-confirm" role="group" aria-label={k(asking)}>
        <p>{k(QUESTIONS[asking], { name: member.name })}</p>
        <Button
          variant="danger-light"
          disabled={busy}
          onClick={() => {
            setAsking('');
            run(asking);
          }}
        >
          {k('confirm')}
        </Button>
        <Button variant="light" disabled={busy} onClick={() => setAsking('')}>
          {k('keep')}
        </Button>
      </div>
    );
  const joined = member.status !== 'pending';
  const keys = joined ? ['signOut', 'reset', 'archive'] : ['resend', 'archive'];
  return keys.map((key) => (
    <Button
      key={key}
      variant={key === 'archive' ? 'danger-light' : 'light'}
      disabled={busy}
      aria-label={k('actionNamed', { action: k(key), name: member.name })}
      onClick={() => (key === 'resend' ? run(key) : setAsking(key))}
    >
      {k(key)}
    </Button>
  ));
}
