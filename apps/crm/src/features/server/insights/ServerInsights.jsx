import React, { useMemo } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useRecords, useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { dubaiMonth, dubaiToday } from '../../../lib/dubaiDate.js';
import { canOpenSection } from '../access.js';
import { useFinance } from '../finance/useFinance.js';
import { followUpsDue } from '../dashboard/kpiModel.js';
import { selectConnectedInsights } from './insightsModel.js';
import { quietClients, viewingsWeekOnWeek } from './insightsKpis.js';
import { InsightsFeed } from './InsightsFeed.jsx';
import { InsightsTiles } from './InsightsTiles.jsx';
import {
  DealsPending,
  LeadTiers,
  LostReasons,
  NeedsQualification,
  PipelineMix,
} from './InsightsPanels.jsx';
import './insights.css';
import './insights-charts.css';

/** The feed's findings, each only for a list the member may open. */
function feedItems({ t, data, insights, leads, schedule, care }) {
  const today = dubaiToday();
  const items = [];
  if (schedule) {
    const week = viewingsWeekOnWeek(data.Viewings, today);
    const trend =
      week.thisWeek > week.lastWeek ? 'Up' : week.thisWeek < week.lastWeek ? 'Down' : 'Steady';
    items.push({
      key: 'viewings',
      icon: 'eye',
      title: t(`insights.viewings${trend}`),
      text: t('insights.viewingsText', { now: week.thisWeek, before: week.lastWeek }),
      when: t('insights.thisWeek'),
      route: 'Viewings',
    });
    const overdue = followUpsDue(data['Follow-ups'], today).overdue;
    items.push({
      key: 'overdue',
      icon: 'clock',
      title: t('insights.overdue'),
      text: t('insights.overdueText', { count: overdue }),
      when: t('insights.today'),
      route: 'Follow-ups',
    });
  }
  if (leads) {
    const quiet = quietClients(data, today);
    const { hot, warm } = insights;
    items.push(
      {
        key: 'quiet',
        icon: 'note',
        title: t('insights.quiet'),
        text: t('insights.quietText', { count: quiet }),
        when: t('insights.today'),
        route: 'Clients',
      },
      {
        key: 'leads',
        icon: 'sparkle',
        title: t('insights.leadsQuality'),
        text: t('insights.leadsQualityText', { hot, warm }),
        when: t('insights.today'),
        route: 'Leads',
      },
    );
  }
  if (care)
    items.push({
      key: 'care',
      icon: 'heart',
      title: t('insights.care'),
      text: t('insights.careText', { count: insights.clientCare }),
      when: t('insights.today'),
      route: 'Client care',
    });
  return items;
}

/**
 * Connected CRM insights from the records this session can see, as the approved mockup's
 * report (design queue item 10): three tiles and what stands out, then the panels. Panels
 * appear only for the modules the member may open; the deal mix needs finance access and uses
 * the scoped finance view, so it is never shown as an empty stand-in.
 */
export function ServerInsights({ owner }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const { data, scope } = useRecords();
  const { dispatchRow } = useWorkspaceActions();
  const finance = useFinance(api, owner.id, user);
  const deals = finance.overview?.deals ?? null;
  const insights = useMemo(() => selectConnectedInsights(data, deals), [data, deals]);
  const leads = canOpenSection(user, 'Clients');
  const schedule = canOpenSection(user, 'Follow-ups');
  const care = canOpenSection(user, 'Client care');
  const dealsPending = finance.access.scope !== 'none' && !finance.overview;
  return (
    <div className="page-stack connected-insights">
      <p className="dashboard-scope">
        {t(scope === 'team' ? 'insights.scopeTeam' : 'insights.scopeOwn')}
      </p>
      <InsightsTiles data={data} month={dubaiMonth()} leads={leads} schedule={schedule} />
      <InsightsFeed items={feedItems({ t, data, insights, leads, schedule, care })} />
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
