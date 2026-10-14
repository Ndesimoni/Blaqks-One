/**
 * DealView parsing (finance-design §6.2, §5.3, §13 M-F5), shaped by scope: the own view never
 * keeps the company share, the override, the second agent's share or another agent's line,
 * even if a response carried them. Calculation sums are checked like the database does.
 */
import {
  allowed,
  bp,
  details,
  fils,
  holder,
  id,
  invalidFinance,
  isoDate,
  list,
  object,
  oneOf,
  optional,
  person,
  text,
  version,
} from './financeValues.js';
import { splitSources } from '../../../lib/finance/commission.js';

export const dealTypes = ['Sale', 'Rental', 'Holiday home'];
export const dealStages = [
  'New',
  'Qualified',
  'Viewing',
  'Offer',
  'Negotiation',
  'Documentation',
  'Completed',
  'Lost',
  'Cancelled',
  'On hold',
];
export const feeBases = ['percentage', 'fixed'];
export const paymentStatuses = ['not_earned', 'outstanding', 'paid'];
export const dealAllowedKeys = ['edit', 'assign', 'earn', 'split', 'revise', 'unearn', 'delete'];

function readLine(row) {
  const line = object(row);
  return {
    role: oneOf(['primary', 'second'])(line.role),
    agent: optional(person)(line.agent),
    shareBp: optional(bp)(line.shareBp),
    amountFils: fils(line.amountFils),
  };
}

/** Team view: every line plus the company share; own view: the primary line only. */
export function readCalculation(value, team) {
  if (value === null || value === undefined) return null;
  const calc = object(value);
  const lines = list(calc.lines ?? [], readLine, 'role');
  const result = {
    preview: calc.preview === true,
    revision: optional(version)(calc.revision),
    grossFils: fils(calc.grossFils),
    partnerFils: fils(calc.partnerFils),
    netFils: fils(calc.netFils),
    vatFils: fils(calc.vatFils),
    companyFils: team ? fils(calc.companyFils) : null,
    lines: team ? lines : lines.filter((line) => line.role === 'primary'),
    adjusted: calc.adjusted === true,
    splitSource: team ? optional(oneOf(splitSources))(calc.splitSource) : null,
  };
  const linesFils = lines.reduce((sum, line) => sum + BigInt(line.amountFils), 0n);
  const sums = BigInt(result.partnerFils) + BigInt(result.netFils) === BigInt(result.grossFils);
  const split = !team || BigInt(result.companyFils) + linesFils === BigInt(result.netFils);
  if (!sums || !split || linesFils > BigInt(result.netFils)) throw invalidFinance();
  return result;
}

function readSecondAgent(value, team) {
  if (value === null || value === undefined) return null;
  const agent = object(value);
  if (!team) return { id: null, name: text(agent.name), shareBp: null };
  return { ...person(agent), shareBp: bp(agent.shareBp) };
}

function readOverride(value, team) {
  if (!team || value === null || value === undefined) return null;
  const override = object(value);
  return { agentShareBp: bp(override.agentShareBp), reason: text(override.reason) };
}

/** One DealView; `team` is true for team-scope responses. */
export function readDeal(row, team) {
  const deal = object(row);
  const feeBasis = oneOf(feeBases)(deal.feeBasis);
  const [feeRateBp, fixedFeeFils] = [
    optional(bp)(deal.feeRateBp),
    optional(fils)(deal.fixedFeeFils),
  ];
  if ((feeBasis === 'fixed' ? fixedFeeFils : feeRateBp) === null) throw invalidFinance();
  return {
    id: id(deal.id),
    version: version(deal.version),
    dealId: id(deal.dealId),
    assignee: holder(deal.assignee),
    clientId: id(deal.clientId),
    propertyId: optional(id)(deal.propertyId),
    dealType: oneOf(dealTypes)(deal.dealType),
    stage: oneOf(dealStages)(deal.stage),
    agreedValueFils: fils(deal.agreedValueFils),
    feeBasis,
    feeRateBp,
    fixedFeeFils,
    partnerShareBp: bp(deal.partnerShareBp),
    partnerName: optional(text)(deal.partnerName),
    earnedOn: optional(isoDate)(deal.earnedOn),
    details: details(deal.details),
    secondAgent: readSecondAgent(deal.secondAgent, team),
    override: readOverride(deal.override, team),
    calculation: readCalculation(deal.calculation, team),
    receivedFils: fils(deal.receivedFils),
    outstandingFils: fils(deal.outstandingFils),
    paymentStatus: oneOf(paymentStatuses)(deal.paymentStatus),
    allowed: allowed(deal.allowed, dealAllowedKeys),
  };
}
