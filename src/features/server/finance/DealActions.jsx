import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useFinanceContext } from './useFinanceRequests.js';

/** Each action, the gated operation it needs and its dialog. Order sets the visual order. */
const dealActions = [
  { action: 'earn', operation: 'earnDeal', label: 'Mark earned', icon: 'check', primary: true },
  { action: 'edit', operation: 'editDeal', label: 'Edit deal', icon: 'edit' },
  { action: 'split', operation: 'splitDeal', label: 'Change split', icon: 'sliders' },
  { action: 'handover', operation: 'handOverDeal', label: 'Hand over', icon: 'users' },
  { action: 'move', operation: 'assignDeal', label: 'Move deal', icon: 'arrow' },
  { action: 'revise', operation: 'reviseDeal', label: 'Revise', icon: 'sliders' },
  { action: 'unearn', operation: 'unearnDeal', label: 'Unearn', icon: 'clock' },
];

/**
 * The deal's footer actions. A button appears only when the caller's `financeAccess` and
 * the row's server-computed `allowed` both permit it; delete stays apart as destructive.
 */
export function DealActions({ deal, onAction, onClose }) {
  const { actions } = useFinanceContext();
  const shown = dealActions.filter((item) => actions.can(item.operation, deal));
  const primary = shown.find((item) => item.primary);
  const secondary = shown.filter((item) => !item.primary);
  const canDelete = actions.can('deleteDeal', deal);
  return (
    <div className="drawer-footer finance-details-footer">
      <div className="finance-action-group">
        <Button variant="light" onClick={onClose}>
          Close
        </Button>
        {canDelete && (
          <Button
            variant="light"
            className="finance-danger-light"
            onClick={() => onAction('delete')}
          >
            Delete deal
          </Button>
        )}
      </div>
      {(primary || secondary.length > 0) && (
        <div className="finance-action-group" role="group" aria-label="Deal actions">
          {secondary.map((item) => (
            <Button
              key={item.action}
              variant="light"
              icon={item.icon}
              onClick={() => onAction(item.action)}
            >
              {item.label}
            </Button>
          ))}
          {primary && (
            <Button icon={primary.icon} onClick={() => onAction(primary.action)}>
              {primary.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
