import React from 'react';
import { ProfileCard } from '../profile/ProfileCard.jsx';
import { WordList } from './WordList.jsx';

/**
 * The mockup's three rule cards: what a first message with property words does (suggest or
 * create), the property words themselves, and the lead sources that always create a lead.
 */
export function RuleCards({ draft, onChange, t }) {
  return (
    <>
      <ProfileCard
        id="rules-mode"
        title={t('inboxRules.mode.title')}
        description={t('inboxRules.mode.body')}
      >
        <fieldset className="acct-card-body rules-choices">
          <legend className="sr-only">{t('inboxRules.mode.label')}</legend>
          {['suggest', 'create'].map((mode) => (
            <label key={mode} className={draft.leadMode === mode ? 'is-selected' : ''}>
              <input
                type="radio"
                name="lead-mode"
                value={mode}
                checked={draft.leadMode === mode}
                onChange={() => onChange({ ...draft, leadMode: mode })}
              />
              <span>
                <strong>{t(`inboxRules.mode.${mode}`)}</strong>
                <small>{t(`inboxRules.mode.${mode}Hint`)}</small>
              </span>
            </label>
          ))}
        </fieldset>
      </ProfileCard>
      <ProfileCard
        id="rules-words"
        title={t('inboxRules.words.title')}
        description={t('inboxRules.words.hint')}
      >
        <div className="acct-card-body">
          <WordList draft={draft} onChange={onChange} />
        </div>
      </ProfileCard>
      <ProfileCard
        id="rules-sources"
        title={t('inboxRules.sources.title')}
        description={t('inboxRules.sources.body')}
      >
        <div className="acct-card-body">
          <div className="profile-switch-row">
            <span>
              <strong id="rules-sources-switch">{t('inboxRules.auto.sources')}</strong>
              <span className="acct-muted">{t('inboxRules.auto.sourcesHint')}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="profile-switch"
              aria-labelledby="rules-sources-switch"
              checked={draft.automatic}
              onChange={(event) => onChange({ ...draft, automatic: event.target.checked })}
            />
          </div>
        </div>
      </ProfileCard>
    </>
  );
}
