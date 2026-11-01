import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useNavigation, useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { useRecordAccess } from '../../records/useRecordAccess.js';
import { createItems } from './createModel.js';
import { useDisclosure } from './useDisclosure.js';

/**
 * The top bar's Create (NAV5): a disclosure listing what this person may create in the current
 * product. Choosing an item puts focus back on Create first, so the editor returns it there.
 */
export function CreateMenu({ product }) {
  const { t } = useI18n();
  const actions = useWorkspaceActions();
  const can = useRecordAccess();
  const { route } = useNavigation();
  const { open, setOpen, root, opener } = useDisclosure();
  const items = createItems(product, can, route);
  if (!items.length || actions.readOnly) return null;
  const choose = (item) => {
    setOpen(false);
    opener.current?.focus();
    actions.add(item.module, item.defaults?.() ?? {});
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
