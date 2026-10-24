import React from 'react';
import { Icon } from './Icon.jsx';

function Empty({
  title = 'Nothing here yet',
  detail = 'No records to show here.',
  icon = 'note',
  action,
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={26} />
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}

export { Empty };
