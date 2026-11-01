import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useWorkspaceScope } from '../../../hooks/useWorkspaceScope.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { useWebsiteEditor } from './useWebsiteEditor.js';
import { websiteAccess } from './websiteModel.js';
import { WebsiteIdentity } from './WebsiteIdentity.jsx';
import { WebsiteThemes } from './WebsiteThemes.jsx';
import { WebsiteCopy } from './WebsiteCopy.jsx';
import { WebsitePreview } from './WebsitePreview.jsx';
import { WebsitePublishBar } from './WebsitePublishBar.jsx';
import { WebsiteReview } from './WebsiteReview.jsx';
import { WebsitePanel, contentTab } from './WebsitePanels.jsx';
import '../profile/profile.css';
import './website.css';
import './website-themes.css';
import './website-actions.css';
import './website-publish.css';

const FORM_ID = 'website-content-form';

/**
 * One site's editor and its sections (NAV): the sidebar and header tabs choose `section`. The
 * content form stays mounted, hidden, while another section is open, so a draft survives.
 */
function WebsiteEditor({ api, workspace, platform, section, t }) {
  const editor = useWebsiteEditor(api, workspace, platform, t);
  const { navigate } = useNavigation();
  const [review, setReview] = useState(false);
  const content = contentTab(platform);
  const tab = section || content;
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
      <div className="website-content page-stack" hidden={tab !== content}>
        <WebsitePublishBar
          editor={editor}
          platform={platform}
          form={FORM_ID}
          onReview={() => setReview(true)}
          t={t}
        />
        <div className="website-editor-layout">
          <form
            id={FORM_ID}
            onSubmit={(event) => {
              event.preventDefault();
              run(event.nativeEvent.submitter?.value || 'save');
            }}
          >
            <fieldset className="website-editor-fields" disabled={busy}>
              <legend className="sr-only">{t('websites.content')}</legend>
              <WebsiteIdentity editor={editor} platform={platform} t={t} />
              {!platform && (
                <WebsiteThemes
                  value={form.theme}
                  onChange={(value) => change('theme', value)}
                  t={t}
                />
              )}
              <WebsiteCopy editor={editor} platform={platform} t={t} />
            </fieldset>
          </form>
          <WebsitePreview form={form} platform={platform} t={t} />
        </div>
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
      {tab !== content && (
        <WebsitePanel
          tab={tab}
          site={state.site}
          onGoToContent={() => navigate(platform ? 'Platform website' : 'Website')}
        />
      )}
    </div>
  );
}

export function ServerWebsite({ platform = false, section }) {
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
      section={section}
      t={t}
    />
  );
}
