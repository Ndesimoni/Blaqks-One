import React from 'react';
import { SUM } from '../../lib/records.js';
import { AED } from '../../lib/format.js';
import { TitleSection } from '../../components/ui/TitleSection.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { useNavigation } from '../../hooks/useWorkspace.js';

export function CommissionPanel({ monthly, maxBar, summary }) {
  const { navigate } = useNavigation();
  return (
    <section className="panel revenue-panel">
      <TitleSection
        heading="Commission performance"
        caption="Fee receipts across the last six months"
        action={
          <button className="text-action" onClick={() => navigate('Performance')}>
            View reports <Icon name="arrow" size={15} />
          </button>
        }
      />
      <div className="chart-total">
        <strong>{AED(SUM(monthly, (x) => x.amount))}</strong>
        <span>Last 6 months · Excluding VAT</span>
      </div>
      <div className="column-chart">
        {monthly.map((x, i) => (
          <div className="column-group" key={x.month}>
            <div className="column-space">
              <div
                className={'column-bar ' + (i === monthly.length - 1 ? 'last' : '')}
                style={{ height: (x.amount / maxBar) * 100 + '%' }}
                role="img"
                aria-label={`${x.month}: ${AED(x.amount)}`}
                title={`${x.month}: ${AED(x.amount)}`}
              />
            </div>
            <small>
              {new Date(x.month + '-01').toLocaleDateString('en-AE', { month: 'short' })}
            </small>
          </div>
        ))}
      </div>
      <div className="mini-insights">
        <div>
          <span>Earned fees to date</span>
          <strong>{AED(summary.earned)}</strong>
        </div>
        <div>
          <span>Outstanding commission</span>
          <strong>{AED(summary.outstanding)}</strong>
        </div>
        <div>
          <span>Operating costs</span>
          <strong>{AED(summary.expenses)}</strong>
        </div>
      </div>
    </section>
  );
}
