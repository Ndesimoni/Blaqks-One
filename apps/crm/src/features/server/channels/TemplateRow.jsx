import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';

const TONES = { approved: 'green', pending: 'amber', rejected: 'red' };

/**
 * One template as Twilio lists it: its name and approval, whether members are offered it,
 * how many values it needs, and its text.
 */
export function TemplateRow({ template, t }) {
  const k = (key, vars) => t(`whatsappTemplates.${key}`, vars);
  const approval = ['approved', 'pending', 'rejected', 'paused', 'disabled'].includes(
    template.approval,
  )
    ? template.approval
    : 'other';
  const offer = template.offered
    ? k('offered')
    : template.approval === 'approved'
      ? k('notText')
      : k('notOffered');
  const facts = [
    offer,
    template.variables > 0 ? k('variables', { count: template.variables }) : k('noVariables'),
    [template.language, template.category].filter(Boolean).join(' · '),
  ].filter(Boolean);
  return (
    <div className="address-row whatsapp-template">
      <div className="address-main">
        <strong>{template.name}</strong>
        <Badge tone={TONES[approval] ?? 'slate'}>{k(`approval.${approval}`)}</Badge>
      </div>
      <small>{facts.join(' · ')}</small>
      {template.body && <p className="whatsapp-template-body">{template.body}</p>}
    </div>
  );
}
