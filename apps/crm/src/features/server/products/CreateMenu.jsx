import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/ui/Icon.jsx';
import { routePath } from '../../../config/routes.js';
import { useSession } from '../../../hooks/useSession.js';
import { useNavigation, useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { useRecordAccess } from '../../records/useRecordAccess.js';
import { createItems } from './createModel.js';
import { useDisclosure } from './useDisclosure.js';

/**
 * The top bar's Create (NAV5): a disclosure listing what this person may create in the current
 * product. Choosing an item puts focus back on Create first, so the editor returns it there;
 * a Messages item opens its page with `?start=`, keeping the open workspace.
 */
export function CreateMenu({ product }) {
  const { t } = useI18n();
  const actions = useWorkspaceActions();
  const can = useRecordAccess();
  const { user } = useSession();
  const { route } = useNavigation();
  const location = useLocation();
  const go = useNavigate();
  const { open, setOpen, root, opener } = useDisclosure();
  const items = createItems(product, can, route, user);
  if (!items.length || actions.readOnly) return null;
  const choose = (item) => {
    setOpen(false);
    opener.current?.focus();
    if (!item.start) return actions.add(item.module, item.defaults?.() ?? {});
    const params = new URLSearchParams();
    const workspace = new URLSearchParams(location.search).get('workspace');
    if (workspace) params.set('workspace', workspace);
    params.set('start', item.start);
    go(`${routePath(item.route)}?${params}`);
  };
  return (
    <div className="create-menu" ref={root}>
      <button
        type="button"
        ref={opener}
        className="btn btn-primary create-button"
        aria-expanded={open}
        aria-controls="create-panel"
        disabled={actions.busy}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="plus" size={16} />
        <span className="create-label">{t('frame.create')}</span>
      </button>
      {open && (
        <div className="create-panel" id="create-panel">
          <span className="create-hint">
            {t('frame.createIn', { product: t(`products.${product}`) })}
          </span>
          {items.map((item) => (
            <button type="button" key={item.key} onClick={() => choose(item)}>
              {t(`frame.items.${item.key}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
