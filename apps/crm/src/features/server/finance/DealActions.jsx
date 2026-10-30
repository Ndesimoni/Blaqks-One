import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useFinanceContext } from './useFinanceRequests.js';

/**
 * Each action, the gated operation it needs and its dialog. Order sets the visual order:
 * routine changes, then the Admin-only revision and unearn (destructive), then the primary.
 */
const dealActions = [
  { action: 'edit', operation: 'editDeal', label: 'Edit deal', icon: 'edit' },
  { action: 'split', operation: 'splitDeal', label: 'Change split', icon: 'sliders' },
  { action: 'handover', operation: 'handOverDeal', label: 'Hand over', icon: 'users' },
  { action: 'move', operation: 'assignDeal', label: 'Move deal', icon: 'arrow' },
  { action: 'revise', operation: 'reviseDeal', label: 'Revise', icon: 'sliders' },
  { action: 'unearn', operation: 'unearnDeal', label: 'Unearn', icon: 'close', danger: true },
  { action: 'earn', operation: 'earnDeal', label: 'Mark earned', icon: 'check', primary: true },
];

/**
 * The deal's footer actions. A button appears only when the caller's `financeAccess` and
 * the row's server-computed `allowed` both permit it. "Mark earned" is the one primary
 * action; Unearn and Delete use the destructive outline and sit apart from routine changes.
 */
export function DealActions({ deal, onAction, onClose }) {
  const { actions } = useFinanceContext();
  const shown = dealActions.filter((item) => actions.can(item.operation, deal));
  const canDelete = actions.can('deleteDeal', deal);
  return (
    <div className="drawer-footer finance-details-footer deal-details-footer">
      <div className="finance-action-group deal-actions-side">
        <Button variant="light" onClick={onClose}>
          Close
        </Button>
        {canDelete && (
          <Button
            variant="light"
            icon="trash"
            className="finance-danger-light"
            onClick={() => onAction('delete')}
          >
            Delete deal
          </Button>
        )}
      </div>
      {shown.length > 0 && (
        <div
          className="finance-action-group deal-actions-main"
          role="group"
          aria-label="Deal actions"
          data-count={shown.length}
        >
          {shown.map((item) => (
            <Button
              key={item.action}
              variant={item.primary ? 'primary' : 'light'}
              icon={item.icon}
              className={
                item.primary ? 'deal-action-primary' : item.danger ? 'finance-danger-light' : ''
              }
              onClick={() => onAction(item.action)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
