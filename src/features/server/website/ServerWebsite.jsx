import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useWorkspaceScope } from '../../../hooks/useWorkspaceScope.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { useWebsiteEditor } from './useWebsiteEditor.js';
import { websiteAccess } from './websiteModel.js';
import { WebsiteOverview } from './WebsiteOverview.jsx';
import { WebsiteIdentity } from './WebsiteIdentity.jsx';
import { WebsiteThemes } from './WebsiteThemes.jsx';
import { WebsiteCopy } from './WebsiteCopy.jsx';
import { WebsiteActions } from './WebsiteActions.jsx';
import { WebsiteReview } from './WebsiteReview.jsx';
import '../profile/profile.css';
import './website.css';
import './website-themes.css';
import './website-actions.css';

function WebsiteEditor({ api, workspace, platform, t }) {
  const editor = useWebsiteEditor(api, workspace, platform, t);
  const [review, setReview] = useState(false);
  const { state, form, busy, error, change, run } = editor;
  if (!state)
    return error ? (
      <section className="panel recovery-panel" role="alert">
        <p className="field-error">{error}</p>
        <Button onClick={editor.reload}>{t('websites.retry')}</Button>
      </section>
    ) : (
      <div className="website-loading" role="status">
        {t('websites.loading')}
        <div />
        <div />
      </div>
    );
  return (
    <div className="website-page page-stack">
      <WebsiteOverview state={state} dirty={editor.dirty} platform={platform} t={t} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          run(event.nativeEvent.submitter?.value || 'save');
        }}
      >
        <fieldset className="website-editor-fields" disabled={busy}>
          <legend className="sr-only">{t('websites.content')}</legend>
          <WebsiteIdentity editor={editor} platform={platform} t={t} />
          {!platform && (
            <WebsiteThemes value={form.theme} onChange={(value) => change('theme', value)} t={t} />
          )}
          <WebsiteCopy form={form} change={change} platform={platform} t={t} />
        </fieldset>
        <WebsiteActions editor={editor} onReview={() => setReview(true)} t={t} />
      </form>
      {review && (
        <WebsiteReview
          form={form}
          dirty={editor.dirty}
          saved={Boolean(state.draft)}
          published={Boolean(state.site)}
          platform={platform}
          onClose={() => setReview(false)}
          t={t}
        />
      )}
    </div>
  );
}

export function ServerWebsite({ platform = false }) {
  const { api, user } = useSession();
  const { owner } = useWorkspaceScope();
  const { t } = useI18n();
  if (!websiteAccess(user, owner, platform))
    return (
      <section className="panel recovery-panel">
        <p>{t(platform ? 'websites.platformRestricted' : 'websites.restricted')}</p>
      </section>
    );
  return (
    <WebsiteEditor
      key={platform ? 'platform' : owner.id}
      api={api}
      workspace={user.workspaceId || user.id}
      platform={platform}
      t={t}
    />
  );
}
