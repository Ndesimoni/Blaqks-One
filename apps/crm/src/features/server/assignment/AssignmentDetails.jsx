import React from 'react';
import { AssigneeField } from './AssigneeField.jsx';
import { TaskClientCard } from './TaskClientCard.jsx';
import { ListingViewings } from './ListingViewings.jsx';
import { isAssignable } from './assignmentModel.js';
import './assignment.css';

/** Connected-only extras for record details, supplied through RecordDetails' `extras` slot. */
export function AssignmentDetails({ module, record }) {
  if (!isAssignable(module)) return null;
  return (
    <div className="assignment-details">
      <AssigneeField module={module} record={record} />
      {module === 'Follow-ups' && <TaskClientCard record={record} />}
      {module === 'Properties' && <ListingViewings record={record} />}
    </div>
  );
}
