/**
 * Strict, scope-aware parsing of `GET /finance` (finance-design §6.2, §13 M-F5). An own-scope
 * model never holds team settings, team totals, the company share or other agents' figures.
 */
import { dealTypes, readDeal } from './dealModel.js';
import { readHandovers } from './dealResponses.js';
import { readExpense, readPayment } from './entryModel.js';
import {
  bp,
  fils,
  id,
  isoDate,
  list,
  object,
  oneOf,
  optional,
  person,
  text,
  total,
} from './financeValues.js';
import { readAgreement, readSettings } from './settingsModel.js';

export * from './financeLabels.js';
export * from './settingsModel.js';

/** Statement lines: second-agent lines carry no share (§13 M-F5). */
function readStatementLine(value) {
  const line = object(value);
  return {
    dealId: id(line.dealId),
    earnedOn: isoDate(line.earnedOn),
    dealType: oneOf(dealTypes)(line.dealType),
    role: oneOf(['primary', 'second'])(line.role),
    shareBp: line.role === 'primary' ? optional(bp)(line.shareBp) : null,
    amountFils: fils(line.amountFils),
    receivedShareFils: fils(line.receivedShareFils),
    outstandingFils: fils(line.outstandingFils),
    adjusted: line.adjusted === true,
  };
}

function readStatement(value) {
  const statement = object(value);
  const totals = object(statement.totals);
  return {
    lines: list(statement.lines, readStatementLine),
    totals: {
      earnedFils: total(totals.earnedFils),
      receivedShareFils: total(totals.receivedShareFils),
      outstandingFils: total(totals.outstandingFils),
    },
  };
}

const teamTotalKeys = ['grossFils', 'partnerFils', 'netFils', 'companyFils', 'vatFils'];
const moreTotalKeys = ['receivedFils', 'outstandingFils', 'expensesApprovedFils', 'pendingCount'];

function readTeamTotals(value) {
  const totals = object(value);
  const sums = [...teamTotalKeys, ...moreTotalKeys].map((key) => [key, total(totals[key])]);
  const byAgent = list(totals.byAgent, (row) => ({
    agent: person(object(row).agent),
    earnedFils: total(row.earnedFils),
    receivedShareFils: total(row.receivedShareFils),
  }));
  return { ...Object.fromEntries(sums), byAgent };
}

const readReferenceList = (rows, key, name) =>
  list(rows ?? [], (row) => ({ id: id(object(row)[key]), name: optional(text)(row[name]) }));

/** The finance overview, shaped by the response's own `scope`. */
export function readFinanceOverview(payload) {
  const body = object(payload);
  const team = oneOf(['team', 'own'])(body.scope) === 'team';
  const references = object(body.references ?? {});
  return {
    scope: body.scope,
    settings: readSettings(body.settings, team),
    myAgreements: list(body.myAgreements, (row) => readAgreement(row), 'id'),
    deals: list(body.deals, (row) => readDeal(row, team), 'id'),
    payments: list(body.payments, readPayment, 'id'),
    expenses: list(body.expenses, readExpense, 'id'),
    handovers: readHandovers(body.handovers),
    statement: readStatement(body.statement),
    teamTotals: team ? readTeamTotals(body.teamTotals) : null,
    references: {
      Clients: readReferenceList(references.Clients, 'client_id', 'full_name'),
      Properties: readReferenceList(references.Properties, 'property_id', 'listing_title'),
    },
  };
}
