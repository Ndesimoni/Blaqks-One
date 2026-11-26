import React, { useId } from 'react';
import { TitleSection } from '../../../components/ui/TitleSection.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { figureSections } from './figureSections.js';
import { figureText } from './metricsFormat.js';
import './platform-figures.css';

/** One figure as a label and value pair; an untracked figure says so instead of a zero. */
function FigureRow({ row, metrics }) {
  const i18n = useI18n();
  const f = (key) => i18n.t(`platformFigures.${key}`);
  const text = figureText(row.kind, row.read(metrics), i18n);
  return (
    <div className="figure-row">
      <dt>
        {f(row.key)}
        {row.hint && <small>{f(`hint.${row.key}`)}</small>}
      </dt>
      <dd className={text === null ? 'is-untracked' : undefined}>{text ?? f('notTracked')}</dd>
    </div>
  );
}

/**
 * One panel of platform figures: totals to date first, then what happened in the chosen period
 * under its own small heading. Platform-wide figures only; no row names a company.
 */
function FigurePanel({ section, metrics }) {
  const { t } = useI18n();
  const headingId = useId();
  const groups = [
    { key: 'now', rows: section.rows.filter((row) => !row.period) },
    { key: 'period', rows: section.rows.filter((row) => row.period) },
  ].filter((group) => group.rows.length);
  return (
    <section className="panel figure-panel" aria-labelledby={headingId}>
      <TitleSection
        heading={<span id={headingId}>{t(`platformFigures.section.${section.key}`)}</span>}
        caption={t(`platformFigures.caption.${section.key}`)}
      />
      {groups.map((group) => (
        <div key={group.key} className="figure-group">
          {group.key === 'period' && (
            <h3 className="figure-group-title">
              {t(`platformMetrics.during.${metrics.period.key}`)}
            </h3>
          )}
          <dl className="figure-list">
            {group.rows.map((row) => (
              <FigureRow key={row.key} row={row} metrics={metrics} />
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}

/** The figure panels: websites, money, brokers, marketplace, growth, people and more. */
export function FigurePanels({ metrics }) {
  return (
    <div className="platform-figures">
      {figureSections.map((section) => (
        <FigurePanel key={section.key} section={section} metrics={metrics} />
      ))}
    </div>
  );
}
