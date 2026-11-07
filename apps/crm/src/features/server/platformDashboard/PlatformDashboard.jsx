import React, { useCallback, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { StateSkeleton, StateView } from '../../../components/ui/StateView.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { CompanyUsage } from './CompanyUsage.jsx';
import { FigurePanels } from './FigurePanels.jsx';
import { MetricsTiles } from './MetricsTiles.jsx';
import { MetricsToolbar } from './MetricsToolbar.jsx';
import { DEFAULT_PERIOD } from './metricsModel.js';
import { TrendPanels } from './TrendPanels.jsx';
import { UsageCompanyPanel } from './UsageCompanyPanel.jsx';
import { usePlatformMetrics } from './usePlatformMetrics.js';
import '../dashboard/chart-tokens.css';
import './platform-dashboard.css';

/**
 * Platform → Dashboard for Blaqks One (BO1d, docs/blaqks-one-console.md §5): the period and
 * Download CSV, four figure tiles, the twelve-month trends, the figure panels and each
 * company's usage. Platform-wide counts and sums only; Blaqks One never sees a company's
 * money, clients or records.
 */
export function PlatformDashboard() {
  const { t } = useI18n();
  const k = (key) => t(`platformMetrics.${key}`);
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const { metrics, loading, error, reload } = usePlatformMetrics(period);
  const [openId, setOpenId] = useState('');
  const close = useCallback(() => setOpenId(''), []);
  let body;
  if (error)
    body = (
      <StateView tone="error" role="alert" icon="close" title={k('errorTitle')} detail={error}>
        <Button onClick={reload}>{k('retry')}</Button>
      </StateView>
    );
  else if (!metrics) body = <StateSkeleton label={k('loading')} rows={6} />;
  else
    body = (
      <>
        <MetricsTiles metrics={metrics} />
        <TrendPanels trends={metrics.trends} />
        <FigurePanels metrics={metrics} />
        <CompanyUsage rows={metrics.companies} onOpen={setOpenId} />
      </>
    );
  return (
    <div className="page-stack platform-dashboard" aria-busy={loading}>
      <MetricsToolbar period={period} onPeriod={setPeriod} metrics={metrics} loading={loading} />
      {body}
      {openId && <UsageCompanyPanel id={openId} onClose={close} onChanged={reload} />}
    </div>
  );
}
