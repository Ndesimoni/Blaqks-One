import React from 'react';
import { Icon } from './Icon.jsx';
import './state-view.css';

/** An empty list or panel in the approved mockup's state style (see `StateView`). */
function Empty({
  title = 'Nothing here yet',
  detail = 'No records to show here.',
  icon = 'note',
  action,
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={28} />
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}

export { Empty };
