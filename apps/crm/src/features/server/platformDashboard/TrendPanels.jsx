import React, { useId } from 'react';
import { TitleSection } from '../../../components/ui/TitleSection.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { compactMoney } from './metricsFormat.js';
import { seriesTotal } from './metricsModel.js';
import { TrendChart } from './TrendChart.jsx';
import { TREND_PANELS } from './trendModel.js';
import './trend-chart.css';
import './trend-tips.css';

/**
 * One trend panel: its heading, its charts and the twelve-month total of its series, or this
 * month's figure where a total means nothing (`latest`: people active each month).
 */
function TrendPanel({ panel, trends }) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`platformMetrics.${key}`, vars);
  const headingId = useId();
  const [first] = panel.series;
  const values = trends[first.key];
  const figure = panel.latest ? values.at(-1) : seriesTotal(values);
  const shown = figure === null ? '—' : first.money ? compactMoney(figure) : format.number(figure);
  const several = panel.series.length > 1;
  return (
    <section className="panel trend-panel" aria-labelledby={headingId}>
      <TitleSection
        heading={<span id={headingId}>{k(`trend.${panel.key}`)}</span>}
        caption={k(`trendCaption.${panel.key}`)}
        action={
          several ? null : (
            <p className="trend-total">
              <span>{k(panel.latest ? 'thisMonth' : 'total12')}</span>
              <strong>{shown}</strong>
            </p>
          )
        }
      />
      <div className={several ? 'trend-multiples' : undefined}>
        {panel.series.map((series) => (
          <TrendChart
            key={series.key}
            label={t(`platformFigures.series.${series.key}`)}
            months={trends.months}
            values={trends[series.key]}
            money={series.money}
            counts={series.count ? trends[series.count] : undefined}
            compact={several}
          />
        ))}
      </div>
    </section>
  );
}

/** The twelve-month trends (BO1d): growth, active users, deals, enquiries, brokers, records. */
export function TrendPanels({ trends }) {
  const { t } = useI18n();
  return (
    <section className="platform-trends" aria-label={t('platformMetrics.trends')}>
      {TREND_PANELS.map((panel) => (
        <TrendPanel key={panel.key} panel={panel} trends={trends} />
      ))}
    </section>
  );
}
