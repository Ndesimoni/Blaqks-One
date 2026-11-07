import React from 'react';
import { ClientPanel } from './ClientPanel.jsx';
import { CreateLeadPanel } from './CreateLeadPanel.jsx';
import { LinkRecordPanel } from './LinkRecordPanel.jsx';

/**
 * The conversation's side panel: client details, or a Create lead or Link form. After a lead
 * is saved or a record linked, the panel shows that client's details.
 */
export function SidePanel({ mode, conversation, onClose, onShow }) {
  const done = () => onShow('details');
  if (mode === 'lead')
    return (
      <CreateLeadPanel
        data={conversation.data}
        onSave={conversation.createLead}
        onClose={onClose}
        onDone={done}
      />
    );
  if (mode === 'link')
    return <LinkRecordPanel onLink={conversation.link} onClose={onClose} onDone={done} />;
  return <ClientPanel conversation={conversation.data} onClose={onClose} />;
}
