// Only deliberately public contact fields are eligible; never infer login contacts.
export function agentContactLinks(agent, property) {
  if (!agent || (property && property.agent !== agent.id)) return [];
  const reference = property ? `PREVIEW-${property.id.padStart(3, '0')}` : '';
  const subject = property
    ? `Property enquiry: ${reference}`
    : `Property enquiry for ${agent.name}`;
  const message = property
    ? `Hi ${agent.name}, I'm interested in ${property.title} (${reference}). Could you share more details?`
    : `Hi ${agent.name}, I'd like to discuss my property requirements.`;
  const links = [];
  const phone = agent.publicWhatsApp || '';
  const email = agent.publicEmail || '';
  if (/^\+[1-9]\d{7,14}$/.test(phone))
    links.push({
      channel: 'whatsapp',
      label: 'WhatsApp',
      href: `https://wa.me/${phone.slice(1)}?text=${encodeURIComponent(message)}`,
      external: true,
    });
  if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email))
    links.push({
      channel: 'email',
      label: 'Email',
      href: `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`,
      external: false,
    });
  return links;
}
