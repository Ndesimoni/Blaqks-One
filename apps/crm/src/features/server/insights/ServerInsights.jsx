import React, { useMemo } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useRecords, useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { Metric } from '../../../components/ui/Metric.jsx';
import { canOpenSection } from '../access.js';
import { useFinance } from '../finance/useFinance.js';
import { selectConnectedInsights } from './insightsModel.js';
import {
  DealsPending,
  LeadTiers,
  LostReasons,
  NeedsQualification,
  PipelineMix,
} from './InsightsPanels.jsx';
import './insights.css';
import './insights-charts.css';

/**
 * Connected CRM insights from the records this session can see. Panels appear only for the
 * modules the member may open; the deal mix needs finance access and uses the scoped finance
 * view, so it is never shown as an empty stand-in.
 */
export function ServerInsights({ owner }) {
  const { api, user } = useSession();
  const { data, scope } = useRecords();
  const { dispatchRow } = useWorkspaceActions();
  const finance = useFinance(api, owner.id, user);
  const deals = finance.overview?.deals ?? null;
  const insights = useMemo(() => selectConnectedInsights(data, deals), [data, deals]);
  const leads = canOpenSection(user, 'Clients');
  const schedule = canOpenSection(user, 'Follow-ups');
  const dealsPending = finance.access.scope !== 'none' && !finance.overview;
  return (
    <div className="page-stack connected-insights">
      <div className="subhead-row">
        <div>
          <h2>Opportunities at a glance</h2>
          <p>
            {scope === 'team'
              ? 'Insights from your whole team’s records'
              : 'Insights from the records assigned to you'}
          </p>
        </div>
      </div>
      <div className="metrics-grid">
        {leads && (
          <>
            <Metric
              name="HOT LEADS"
              value={insights.hot}
              sub="High qualification score"
              icon="sparkle"
              accent="mint"
            />
            <Metric
              name="WARM LEADS"
              value={insights.warm}
              sub="Require further nurturing"
              icon="users"
              accent="sand"
            />
          </>
        )}
        {schedule && (
          <>
            <Metric
              name="FOLLOW-UPS OVERDUE"
              value={insights.dueTasks}
              sub="Requires your attention"
              icon="bell"
              accent="rose"
            />
            <Metric
              name="CLIENT CARE DUE"
              value={insights.clientCare}
              sub="Relationship touchpoints"
              icon="heart"
              accent="sky"
            />
          </>
        )}
      </div>
      <div className="two-grid insights-grid">
        {leads && <LeadTiers tiers={insights.tiers} />}
        {insights.pipelines && (
          <PipelineMix
            pipelines={insights.pipelines}
            total={insights.dealTotal}
            team={finance.overview.scope === 'team'}
          />
        )}
        {dealsPending && <DealsPending finance={finance} />}
      </div>
      {leads && (
        <div className="two-grid insights-grid">
          <LostReasons reasons={insights.lostReasons} withDeals={Boolean(deals)} />
          <NeedsQualification
            clients={insights.unqualified}
            onOpen={(client) => dispatchRow('Clients', client)}
          />
        </div>
      )}
    </div>
  );
}
