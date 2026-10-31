import { propertyBy, companyBy, agentBy } from './data.js';

export function enquiryRecipient(ctx) {
  const q = ctx.query,
    s = ctx.scope;
  const p = propertyBy(q.get('listing'));
  const requestedCompany = companyBy(q.get('company'));
  const requestedAgent = agentBy(q.get('agent'));
  if (
    (q.has('listing') && !p) ||
    (q.has('company') && !requestedCompany) ||
    (q.has('agent') && !requestedAgent)
  )
    return null;
  const a = p ? agentBy(p.agent) : requestedAgent;
  const c = companyBy(p?.company || a?.company || requestedCompany?.id || s.site);
  if (requestedAgent && a?.id !== requestedAgent.id) return null;
  if (requestedCompany && c?.id !== requestedCompany.id) return null;
  if (a && a.company !== c?.id) return null;
  if (s.site && c?.id !== s.site) return null;
  if (q.has('platform') && (q.get('platform') !== '1' || c || p || a)) return null;
  const recipient = a ? `${a.name} · ${c.name}` : c ? c.name : 'Blaqks One platform support';
  return { p, c, a, recipient };
}
