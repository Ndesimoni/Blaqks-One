import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';

export function WebsiteActions({ editor, onReview, t }) {
  const { state, busy, dirty, conflict, needsRecovery, reload, recover, error, notice } = editor;
  return (
    <div className="website-action-area">
      <div aria-live="polite">
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="website-success">
            {notice}
          </p>
        )}
        {needsRecovery && !conflict && (
          <p className="website-recovery-notice">{t('websites.staleDraft')}</p>
        )}
      </div>
      <div className="website-actions">
        <p>{t('websites.savingHelp')}</p>
        <div className="website-action-buttons">
          <Button variant="light" disabled={busy} onClick={reload}>
            {t('websites.reload')}
          </Button>
          {state.draft && state.site && (
            <Button variant="light" disabled={busy || conflict} onClick={recover}>
              {t('websites.startPublished')}
            </Button>
          )}
          <Button variant="light" disabled={busy} onClick={onReview}>
            {t('websites.review')}
          </Button>
          <Button
            type="submit"
            name="intent"
            value="save"
            variant="light"
            disabled={busy || conflict || (!dirty && Boolean(state.draft))}
          >
            {t(busy ? 'websites.saving' : 'websites.saveDraft')}
          </Button>
          <Button
            type="submit"
            name="intent"
            value="publish"
            disabled={busy || conflict || needsRecovery}
          >
            {t(
              busy
                ? 'websites.saving'
                : state.draft && !dirty
                  ? 'websites.publishDraft'
                  : 'websites.savePublish',
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
