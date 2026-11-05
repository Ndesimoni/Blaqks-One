import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { ContactCommand } from '../../records/panel/ContactCommand.jsx';
import { contactLinks } from './clientsModel.js';

const ICONS = { call: 'phone', whatsapp: 'chat', email: 'mail', text: 'smartphone' };

/**
 * Call, WhatsApp, Email and Text as square icon links that open the phone's own apps at once
 * (owner, 2026-11-05; the CRM's Call button pattern). Nothing is sent from here; a link the
 * client's details cannot support (no full number, no plain address) is left out.
 */
export function ClientContactLinks({ client }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`platformClients.${key}`, vars);
  const links = contactLinks(client);
  const name = client.contactName || client.companyName;
  const commands = [
    ['call', links.call],
    ['whatsapp', links.whatsapp],
    ['email', links.email],
    ['text', links.sms],
  ].filter(([, href]) => href);
  if (!commands.length) return null;
  return (
    <div
      className="platform-client-contact"
      role="group"
      aria-label={k('contactActions', { name })}
    >
      {commands.map(([key, href]) => (
        <ContactCommand
          key={key}
          iconOnly
          command={{ href, icon: ICONS[key], label: k(key), name: k(`${key}Named`, { name }) }}
        />
      ))}
    </div>
  );
}
