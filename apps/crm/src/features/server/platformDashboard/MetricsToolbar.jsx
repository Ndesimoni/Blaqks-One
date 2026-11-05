import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { dubaiToday } from '../../../lib/dubaiDate.js';
import { downloadBlob } from '../../../services/files/download.js';
import { metricsCsv, metricsCsvName } from './metricsCsv.js';
import { PERIODS } from './metricsModel.js';
import '../../records/grid/grid-filter.css';
import '../dashboard/dashboard-toolbar.css';

/**
 * The platform dashboard's toolbar row (the CRM Dashboard's pattern): the period as pressed
 * chips, when the figures were read, and Download CSV on the right for investor packs. The
 * download waits until the chosen period's figures have arrived.
 */
export function MetricsToolbar({ period, onPeriod, metrics, loading }) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`platformMetrics.${key}`, vars);
  const download = () => {
    const csv = metricsCsv(metrics, t);
    downloadBlob(
      new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }),
      metricsCsvName(metrics.period.key, dubaiToday()),
    );
  };
  return (
    <section className="dashboard-toolbar platform-toolbar" aria-label={k('toolbar')}>
      <div className="grid-presets" role="group" aria-label={k('periodGroup')}>
        {PERIODS.map((key) => (
          <button
            key={key}
            type="button"
            className="grid-chip"
            aria-pressed={key === period}
            onClick={() => onPeriod(key)}
          >
            {k(`period.${key}`)}
          </button>
        ))}
      </div>
      <p className="dashboard-scope" role="status">
        {loading && metrics
          ? k('updating')
          : metrics
            ? k('updated', { time: format.dateTime(metrics.generatedAt) })
            : ''}
      </p>
      <Button
        variant="light"
        icon="download"
        className="platform-download"
        disabled={!metrics || loading}
        onClick={download}
      >
        {k('download')}
      </Button>
    </section>
  );
}
