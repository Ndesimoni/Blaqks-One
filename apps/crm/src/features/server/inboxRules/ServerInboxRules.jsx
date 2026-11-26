import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { ProfileCard } from '../profile/ProfileCard.jsx';
import '../profile/profile-cards.css';
import '../profile/profile.css';
import { BlockedSenders } from './BlockedSenders.jsx';
import { RuleCards } from './RuleCards.jsx';
import { toDraft, useInboxRules } from './useInboxRules.js';
import './inbox-rules.css';

/**
 * Inbox rules (plan U2, design LeadRules) as the approved mockup's cards and save bar (design
 * queue item 18), Admin only: which unknown senders become leads on their own, the property
 * words and whether they suggest or create, who receives new conversations and the blocked
 * senders. The rules save together with their version.
 */
export function ServerInboxRules() {
  const { api, user } = useSession();
  const { t } = useI18n();
  const rules = useInboxRules(api, user.workspaceId);
  const [draft, setDraft] = useState(null);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (rules.rules) setDraft(toDraft(rules.rules));
  }, [rules.rules]);
  if (rules.status === 'error')
    return (
      <section className="panel recovery-panel" role="alert">
        <p>{t('inboxRules.loadFailed')}</p>
        <Button onClick={rules.reload}>{t('inboxRules.retry')}</Button>
      </section>
    );
  if (!draft) return <p role="status">{t('inboxRules.loading')}</p>;
  const changed = JSON.stringify(draft) !== JSON.stringify(toDraft(rules.rules));
  const change = (next) => {
    setDraft(next);
    setNotice('');
  };
  const save = async () => {
    setSaving(true);
    const result = await rules.save(draft);
    setSaving(false);
    setNotice(t(`inboxRules.notice.${result || 'saved'}`));
  };
  return (
    <div className="page-stack rules-page">
      <div className="profile-grid rules-grid">
        <RuleCards draft={draft} onChange={change} t={t} />
        <ProfileCard id="rules-known" title={t('inboxRules.known.title')}>
          <div className="acct-card-body">
            <span className="rules-tag">{t('inboxRules.always')}</span>
            <p className="acct-muted">{t('inboxRules.known.body')}</p>
          </div>
        </ProfileCard>
        <ProfileCard id="rules-route" title={t('inboxRules.route.title')}>
          <div className="acct-card-body">
            <ol className="rules-route">
              <li>{t('inboxRules.route.listing')}</li>
              <li>{t('inboxRules.route.client')}</li>
              <li>{t('inboxRules.route.queue')}</li>
            </ol>
          </div>
        </ProfileCard>
        <BlockedSenders api={api} workspaceId={user.workspaceId} />
      </div>
      <div className="panel profile-save-bar">
        <div className="acct-card-foot">
          <div className="acct-foot-status">
            <p className="acct-muted" role="status" aria-live="polite">
              {notice ||
                (changed
                  ? t('inboxRules.unsaved')
                  : rules.rules.version > 0
                    ? t('inboxRules.version', { version: rules.rules.version })
                    : t('inboxRules.defaults'))}
            </p>
          </div>
          <div className="acct-actions">
            <Button
              variant="light"
              disabled={saving || !changed}
              onClick={() => change(toDraft(rules.rules))}
            >
              {t('inboxRules.cancel')}
            </Button>
            <Button disabled={saving || !changed} onClick={save}>
              {saving ? t('inboxRules.saving') : t('inboxRules.save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
