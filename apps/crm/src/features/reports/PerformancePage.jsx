import { selectMonthlyPerformance, selectPerformanceMonth } from './selectors.js';
import { Icon } from '../../components/ui/Icon.jsx';
import { TitleSection } from '../../components/ui/TitleSection.jsx';
import { AED } from '../../lib/format.js';
import React from 'react';
import { useRecords, usePreferences, useWorkspaceView } from '../../hooks/useWorkspace.js';

function PerformancePage() {
  const { data } = useRecords();
  const { settings, setSettings } = usePreferences();
  const { reportMonth, setReportMonth } = useWorkspaceView();

  const monthRows = selectMonthlyPerformance(data);
  const curr = selectPerformanceMonth(data, reportMonth);
  const fields = [
    { label: 'New enquiries', key: 'newLeads' },
    { label: 'Completed viewings', key: 'viewings' },
    { label: 'Completed deals', key: 'deals' },
    { label: 'Earned fees', key: 'fees', money: true },
  ];
  const targets = settings.targets?.[reportMonth] || {};
  const max = Math.max(1, ...monthRows.map((x) => x.fees));
  return (
    <div className="page-stack">
      <div className="panel report-head">
        <div>
          <span className="eyebrow">BUSINESS INTELLIGENCE</span>
          <h2>Measure what moves your business.</h2>
          <p>Set monthly targets and track how client conversations convert into deals.</p>
        </div>
        <label className="date-select">
          <Icon name="calendar" size={16} />
          <input
            aria-label="Performance month"
            type="month"
            value={reportMonth}
            onChange={(e) => setReportMonth(e.target.value)}
          />
        </label>
      </div>
      <div className="performance-grid">
        <section className="panel">
          <TitleSection heading="Monthly goals" caption="Editable targets · automatic actuals" />
          <div className="goals">
            {fields.map((f) => {
              const val = curr?.[f.key] || 0;
              const target = Number(targets[f.key]) || 0;
              const pct = target ? Math.min(100, (val / target) * 100) : 0;
              return (
                <div className="goal" key={f.key}>
                  <div className="goal-top">
                    <strong>{f.label}</strong>
                    <span>
                      {f.money ? AED(val) : val} /{' '}
                      <input
                        aria-label={`Target for ${f.label}`}
                        type="number"
                        min="0"
                        placeholder="Set target"
                        value={targets[f.key] ?? ''}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            targets: {
                              ...s.targets,
                              [reportMonth]: {
                                ...(s.targets?.[reportMonth] || {}),
                                [f.key]: e.target.value,
                              },
                            },
                          }))
                        }
                      />
                    </span>
                  </div>
                  <div className="goal-track">
                    <div style={{ width: pct + '%' }} />
                  </div>
                  <small>
                    {target
                      ? Math.round((val / target) * 100) + '% of target achieved'
                      : 'Add a target to track progress'}
                  </small>
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel">
          <TitleSection heading="Fee earnings by month" caption="Your share on recorded deals" />
          <div className="perf-chart">
            {monthRows.map((x, i) => (
              <div className="perf-bar-wrap" key={x.month}>
                <div
                  className="perf-bar"
                  style={{ height: Math.max(1, (x.fees / max) * 100) + '%' }}
                  title={`${x.month}: ${AED(x.fees)}`}
                />
                <small>
                  {new Date(x.month + '-01').toLocaleDateString('en-AE', { month: 'short' })}
                </small>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="panel">
        <TitleSection heading="Monthly performance history" caption="12-month rolling overview" />
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>New enquiries</th>
                <th>Completed viewings</th>
                <th>Completed deals</th>
                <th>Earned fees</th>
              </tr>
            </thead>
            <tbody>
              {[...monthRows].reverse().map((r) => (
                <tr key={r.month}>
                  <td className="cell-strong">
                    {new Date(r.month + '-01').toLocaleDateString('en-AE', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </td>
                  <td>{r.newLeads}</td>
                  <td>{r.viewings}</td>
                  <td>{r.deals}</td>
                  <td>{AED(r.fees)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export { PerformancePage };
