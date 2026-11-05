import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useSession } from '../../../hooks/useSession.js';
import { useWorkspaceScope } from '../../../hooks/useWorkspaceScope.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { returnedValues } from './mailboxModel.js';
import './mailbox.css';

/**
 * Finishes the Google sign-in (E1a/E1d). The code is read once, removed from the address bar
 * and history at once, never stored or logged, and posted with the session's CSRF token.
 */
export function GoogleReturn() {
  const { api } = useSession();
  const { owner } = useWorkspaceScope();
  const { navigate } = useNavigation();
  const { t } = useI18n();
  const [result, setResult] = useState('working');
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const { state, code, error } = returnedValues(window.location.hash);
    window.history.replaceState(null, '', `${window.location.pathname}#/oauth/google`);
    if (error || !state || !code) {
      setResult(error === 'denied' ? 'denied' : 'failed');
      return;
    }
    api.finishGoogleSignIn(owner.id, { state, code }).then(
      () => setResult('done'),
      () => setResult('failed'),
    );
  }, [api, owner.id]);
  return (
    <section className="mailbox-card mailbox-return" aria-live="polite">
      <h2>{t('mailbox.return.title')}</h2>
      <p role={result === 'failed' ? 'alert' : 'status'}>{t(`mailbox.return.${result}`)}</p>
      {result !== 'working' && (
        <Button onClick={() => navigate('My mailbox')}>{t('mailbox.return.open')}</Button>
      )}
    </section>
  );
}
