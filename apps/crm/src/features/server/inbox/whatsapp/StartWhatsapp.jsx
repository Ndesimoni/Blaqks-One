import React, { useId, useState } from 'react';
import { Button } from '../../../../components/ui/Button.jsx';
import { useSession } from '../../../../hooks/useSession.js';
import { useWorkspaceScope } from '../../../../hooks/useWorkspaceScope.js';
import { useI18n } from '../../../../i18n/useI18n.js';
import { AgreementPanel } from './AgreementPanel.jsx';
import { StartNotice } from './StartNotice.jsx';
import { TemplateForm } from './TemplateForm.jsx';
import { TemplateNotice } from './WhatsappNotice.jsx';
import { WhatsappStatus } from './WhatsappStatus.jsx';
import { useWhatsappStart } from './useWhatsappStart.js';

/**
 * Start message on WhatsApp from a client or contact (W1b, design §18): from the member's own
 * number to the client's number as the server derived it, with the client's agreement and an
 * approved template. An existing thread on the member's number can be opened instead
 * (`onOpen`, when the messenger is available); a template sent here continues it. Every
 * reason it cannot start is said in plain words. `onStarted(conversationId)` follows a send.
 */
export function StartWhatsapp({ person, panel = {}, onStarted, onOpen }) {
  const { t } = useI18n();
  const { api, user } = useSession();
  const { owner } = useWorkspaceScope();
  const id = useId();
  const start = useWhatsappStart(api, owner.id, person, t('whatsappStart.phoneChanged'));
  const [agreement, setAgreement] = useState(false);
  const name = person.name || person.legacy;
  const box = (children) => (
    <div className="drawer-body inbox-start-body wa-start" {...panel}>
      {children}
    </div>
  );
  if (start.status === 'loading')
    return box(
      <div className="wa-start-loading" role="status" aria-label={t('whatsappStart.loading')}>
        <span />
        <span />
        <span />
      </div>,
    );
  if (start.status === 'error')
    return box(
      <div className="inbox-reply-notice" role="alert">
        <span>{t('whatsappStart.loadError')}</span>
        <Button variant="light" onClick={start.reload}>
          {t('whatsappStart.retry')}
        </Button>
      </div>,
    );
  const { data } = start;
  const send = async (template) => {
    const { result, failure } = await start.start(template);
    if (!failure) onStarted(result?.conversationId);
    return failure;
  };
  let body;
  if (agreement)
    body = (
      <AgreementPanel
        id={`${id}-agreement`}
        consent={data.consent}
        user={user}
        onRecord={start.consent}
        onClose={() => setAgreement(false)}
      />
    );
  else if (!data.canStart)
    body = (
      <StartNotice refusal={data.refusal} user={user} onAgreement={() => setAgreement(true)} />
    );
  else if (!data.templates?.length) body = <TemplateNotice state="noTemplates" />;
  else
    body = (
      <TemplateForm
        id={`${id}-wa`}
        templates={data.templates}
        failedKey="whatsappStart.failed"
        onSend={send}
      />
    );
  return box(
    <>
      <dl className="wa-route">
        <div>
          <dt>{t('whatsappStart.from')}</dt>
          <dd>
            {data.number ? (
              <bdi className="u-ltr">{data.number.phone}</bdi>
            ) : (
              t('whatsappStart.noNumber')
            )}
          </dd>
        </div>
        <div>
          <dt>{t('whatsappStart.to')}</dt>
          <dd>
            <strong>{name}</strong>
            {data.contact ? (
              <bdi className="u-ltr">{data.contact.phone}</bdi>
            ) : (
              <span>{t('whatsappStart.noPhone')}</span>
            )}
          </dd>
        </div>
      </dl>
      {data.contact && (
        <WhatsappStatus
          whatsapp={{ canSend: false, consent: data.consent }}
          panelId={`${id}-agreement`}
          agreementOpen={agreement}
          onAgreement={() => setAgreement((open) => !open)}
        />
      )}
      {data.conversationId && onOpen && (
        <div className="wa-existing">
          <span>{t('whatsappStart.existing', { name })}</span>
          <Button variant="light" icon="chat" onClick={() => onOpen(data.conversationId)}>
            {t('whatsappStart.open')}
          </Button>
        </div>
      )}
      {body}
    </>,
  );
}
