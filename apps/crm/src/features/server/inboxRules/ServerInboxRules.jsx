import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { toDraft, useInboxRules } from './useInboxRules.js';
import { WordList } from './WordList.jsx';
import './inbox-rules.css';
import './inbox-rules-states.css';

/**
 * Inbox rules (plan U2, design LeadRules), Admin only: which unknown senders become leads on
 * their own, the property words and whether they suggest or create. Saves with a version.
 */
export function ServerInboxRules() {
  const { api, user } = useSession();
  const { t } = useI18n();
  const { navigate } = useNavigation();
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
  const save = async () => {
    setSaving(true);
    const result = await rules.save(draft);
    setSaving(false);
    setNotice(t(`inboxRules.notice.${result || 'saved'}`));
  };
  return (
    <div className="rules-page">
      <section className="rules-card rules-row" aria-labelledby="rules-known">
        <span className="rules-tag">{t('inboxRules.always')}</span>
        <div>
          <h2 id="rules-known">{t('inboxRules.known.title')}</h2>
          <p>{t('inboxRules.known.body')}</p>
        </div>
      </section>
      <section className="rules-card" aria-labelledby="rules-auto">
        <h2 id="rules-auto">{t('inboxRules.auto.title')}</h2>
        <label className="rules-check">
          <input
            type="checkbox"
            checked={draft.automatic}
            onChange={(event) => setDraft({ ...draft, automatic: event.target.checked })}
          />
          <span>
            <strong>{t('inboxRules.auto.sources')}</strong>
            <small>{t('inboxRules.auto.sourcesHint')}</small>
          </span>
        </label>
        <div className="rules-check rules-words-rule">
          <span className="rules-always">{t('inboxRules.words.alwaysOn')}</span>
          <span>
            <strong>{t('inboxRules.words.title')}</strong>
            <small>{t('inboxRules.words.hint')}</small>
            <WordList draft={draft} onChange={setDraft} />
          </span>
        </div>
        <fieldset className="rules-modes">
          <legend className="sr-only">{t('inboxRules.mode.label')}</legend>
          {['suggest', 'create'].map((mode) => (
            <label key={mode} className={draft.leadMode === mode ? 'is-selected' : ''}>
              <input
                type="radio"
                name="lead-mode"
                value={mode}
                checked={draft.leadMode === mode}
                onChange={() => setDraft({ ...draft, leadMode: mode })}
              />
              {t(`inboxRules.mode.${mode}`)}
            </label>
          ))}
        </fieldset>
      </section>
      <section className="rules-card" aria-labelledby="rules-route">
        <h2 id="rules-route">{t('inboxRules.route.title')}</h2>
        <ol>
          <li>{t('inboxRules.route.listing')}</li>
          <li>{t('inboxRules.route.client')}</li>
          <li>{t('inboxRules.route.queue')}</li>
        </ol>
      </section>
      <section className="rules-card rules-row" aria-labelledby="rules-block">
        <div>
          <h2 id="rules-block">{t('inboxRules.blocked.title')}</h2>
          <p>{t('inboxRules.blocked.body')}</p>
        </div>
        <Button variant="light" onClick={() => navigate('Inbox')}>
          {t('inboxRules.blocked.open')}
        </Button>
      </section>
      <div className="rules-actions">
        <p role="status" aria-live="polite">
          {notice}
        </p>
        <Button variant="light" disabled={saving} onClick={() => setDraft(toDraft(rules.rules))}>
          {t('inboxRules.cancel')}
        </Button>
        <Button disabled={saving} onClick={save}>
          {saving ? t('inboxRules.saving') : t('inboxRules.save')}
        </Button>
      </div>
    </div>
  );
}
