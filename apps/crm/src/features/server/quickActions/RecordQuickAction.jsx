import { useLocation, useNavigate } from 'react-router-dom';
import { routePath } from '../../../config/routes.js';
import { useSession } from '../../../hooks/useSession.js';
import { useWorkspaceActions, useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { usePanelCommand } from '../../records/panel/panelCommands.js';
import { canOpenSection } from '../access.js';
import { canFinance } from '../finance/financeAccess.js';
import { quickAction } from './quickActionModel.js';

/**
 * The slider's primary quick action from the approved mockup: a client's or lead's Convert to
 * deal opens New deal on Deals with this client chosen; a contact's Add a property opens the
 * property form already linked to them. Offered only to people who may create that record;
 * the page itself still checks every save.
 */
export function RecordQuickAction({ module, record }) {
  const { t } = useI18n();
  const { user } = useSession();
  const { add, can, readOnly } = useWorkspaceActions();
  const { setDetail } = useWorkspaceView();
  const location = useLocation();
  const go = useNavigate();
  const allowed = {
    deal: canOpenSection(user, 'Deals') && canFinance(user, 'create'),
    property: can('Properties', 'create'),
  };
  const action = readOnly ? null : quickAction(module, record, allowed);
  const run = () => {
    setDetail(null);
    if (action.kind === 'property') return add('Properties', action.defaults);
    const params = new URLSearchParams();
    const workspace = new URLSearchParams(location.search).get('workspace');
    if (workspace) params.set('workspace', workspace);
    params.set('start', 'deal');
    params.set('client', action.clientId);
    go(`${routePath('Deals')}?${params}`);
  };
  usePanelCommand('quick', action && { label: t(action.label), icon: action.icon, run });
  return null;
}
