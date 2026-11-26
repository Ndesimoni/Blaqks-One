import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { OverflowList } from '../../../components/ui/OverflowList.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { TemplateRow } from './TemplateRow.jsx';
import { useWhatsappTemplates } from './useWhatsappTemplates.js';

/**
 * The company's WhatsApp message templates (W1b, design §8): every template Twilio lists,
 * with its approval and whether members are offered it, when the list was last read (or that
 * the last read failed), and Refresh to read Twilio again. One small complete section.
 */
export function WhatsappTemplates({ api, workspaceId, connection, t }) {
  const { format } = useI18n();
  const loaded = useWhatsappTemplates(api, workspaceId, connection.version);
  const [notice, setNotice] = useState(null);
  const k = (key, vars) => t(`whatsappTemplates.${key}`, vars);
  const view = loaded.view;
  const refresh = async () => {
    setNotice(null);
    const failure = await loaded.refresh();
    setNotice(failure ? { error: true, text: failure } : { text: k('refreshed') });
  };
  const read = view?.checkedAt ? format.dateTime(view.checkedAt) : '';
  const synced =
    view &&
    (view.sync === 'failed'
      ? k('syncFailed', { date: read })
      : read
        ? k('synced', { date: read })
        : k('never'));
  return (
    <section
      className="channel-card addresses-card whatsapp-templates-card"
      aria-labelledby="whatsapp-templates"
    >
      <header className="channel-head">
        <span className="channel-icon" aria-hidden="true">
          <Icon name="layers" size={20} />
        </span>
        <div>
          <h2 id="whatsapp-templates">{k('title')}</h2>
          <p>{k('intro')}</p>
        </div>
        <Button variant="light" disabled={loaded.busy} onClick={refresh}>
          {loaded.busy ? k('refreshing') : k('refresh')}
        </Button>
      </header>
      <div role="status" aria-live="polite">
        {notice && (
          <p className={notice.error ? 'field-error' : 'channels-notice'}>{notice.text}</p>
        )}
      </div>
      {synced && (
        <p className={view.sync === 'failed' ? 'channel-attention' : 'channels-muted'}>{synced}</p>
      )}
      {loaded.error && !view ? (
        <div className="channel-actions" role="alert">
          <p className="field-error">{k('loadError')}</p>
          <Button variant="light" onClick={loaded.reload}>
            {t('channels.retry')}
          </Button>
        </div>
      ) : !view ? (
        <p className="channels-muted" role="status">
          {k('loading')}
        </p>
      ) : view.templates.length === 0 ? (
        <div className="whatsapp-empty">
          <strong>{k('empty')}</strong>
          <p>{k('emptyHint')}</p>
        </div>
      ) : (
        <OverflowList
          mode="all"
          items={view.templates}
          getKey={(template) => template.id}
          label={k('title')}
          listClassName="address-list"
          renderItem={(template) => <TemplateRow key={template.id} template={template} t={t} />}
        />
      )}
    </section>
  );
}
