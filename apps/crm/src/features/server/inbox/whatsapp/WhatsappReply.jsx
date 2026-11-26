import React, { useState } from 'react';
import { useI18n } from '../../../../i18n/useI18n.js';
import { ReplyForm } from '../ReplyForm.jsx';
import { AgreementPanel } from './AgreementPanel.jsx';
import { TemplateForm } from './TemplateForm.jsx';
import { TemplateNotice, WhatsappNotice } from './WhatsappNotice.jsx';
import { WhatsappStatus } from './WhatsappStatus.jsx';
import { TEXT_LIMIT, replyMode, templateState } from './whatsappModel.js';

/**
 * The Reply tab of a WhatsApp conversation (W1b, design §5): the window and agreement line,
 * then free text while the 24-hour window is open (the email reply form with its draft and
 * saved replies, without attachments) or an approved template, which needs the client's
 * agreement. The server's `conversation.whatsapp` decides; a refusal is explained instead.
 * `actions` holds `{reply, sendTemplate, consent}`, each resolving to '' or the reason.
 */
export function WhatsappReply({ id, conversation, user, members, toolSlot, onPicked, actions }) {
  const { t } = useI18n();
  const whatsapp = conversation.whatsapp;
  const [chosen, setChosen] = useState('');
  const [agreement, setAgreement] = useState(false);
  const mode = replyMode(whatsapp, chosen);
  const panelId = `${id}-agreement`;
  const ready = templateState(whatsapp.consent, whatsapp.templates);
  const switchTo =
    mode === 'text' ? 'template' : mode === 'template' && whatsapp.canSendText ? 'text' : '';
  let body;
  if (agreement)
    body = (
      <AgreementPanel
        id={panelId}
        consent={whatsapp.consent}
        user={user}
        onRecord={actions.consent}
        onClose={() => setAgreement(false)}
      />
    );
  else if (mode === 'refused')
    body = (
      <WhatsappNotice
        whatsapp={whatsapp}
        user={user}
        members={members}
        onAgreement={() => setAgreement(true)}
      />
    );
  else if (mode === 'text')
    body = (
      <ReplyForm
        key={conversation.id}
        id={id}
        conversation={conversation}
        mailbox={null}
        maxLength={TEXT_LIMIT}
        attachOff={t('whatsappSend.attach.off')}
        toolSlot={toolSlot}
        onPicked={onPicked}
        onReply={(text) => actions.reply(text)}
      />
    );
  else if (ready !== 'ready')
    body = <TemplateNotice state={ready} onAgreement={() => setAgreement(true)} />;
  else
    body = (
      <TemplateForm
        key={conversation.id}
        id={`${id}-wa`}
        templates={whatsapp.templates}
        failedKey="whatsappSend.template.failed"
        onSend={actions.sendTemplate}
      />
    );
  return (
    <div className="wa-reply">
      <WhatsappStatus
        whatsapp={whatsapp}
        panelId={panelId}
        agreementOpen={agreement}
        onAgreement={() => setAgreement((open) => !open)}
        switchTo={agreement ? '' : switchTo}
        onSwitch={() => setChosen(switchTo === 'template' ? 'template' : '')}
      />
      {body}
    </div>
  );
}
