import { Icon } from './Icon.jsx';
import React from 'react';

function Metric({ name, value, sub, icon, trend, accent }) {
  return (
    <div className="metric">
      <div className="metric-head">
        <span>{name}</span>
        <span className={'metric-icon ' + (accent || '')}>
          <Icon name={icon} size={19} />
        </span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot">
        {trend && (
          <span className="trend">
            <Icon name="trend" size={12} />
            {trend}
          </span>
        )}
        {sub}
      </div>
    </div>
  );
}

export { Metric };
