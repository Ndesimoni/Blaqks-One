import React, { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../../../components/ui/Button.jsx';
import { Drawer } from '../../../../components/ui/Drawer.jsx';
import { useI18n } from '../../../../i18n/useI18n.js';
import { SavedReplyForm } from './SavedReplyForm.jsx';
import { SavedReplyRow } from './SavedReplyRow.jsx';

const LIMITS = { company: 200, mine: 100 };

/**
 * Manage saved replies (docs/saved-replies-drafts.md §5): Company and Mine tabs; members
 * read the company list, the Admin changes it. Rendered on the page body so the message
 * box's styles do not reach it; its form never submits the reply (SavedReplyForm).
 */
export function ManageSavedReplies({ saved, start, onClose }) {
  const { t } = useI18n();
  const id = useId();
  const admin = Boolean(saved.data?.canManageCompany);
  const [tab, setTab] = useState(admin ? 'company' : 'mine');
  const [editing, setEditing] = useState(
    start === 'add' ? { scope: admin ? 'company' : 'mine' } : null,
  );
  const [announce, setAnnounce] = useState('');
  const cancelRef = useRef(null);
  // While editing, close and Escape act like Cancel, which asks before losing changes.
  const close = () => (editing ? cancelRef.current?.() : onClose());
  const list = saved.data?.[tab] ?? [];
  const canChange = tab === 'mine' || admin;
  const full = list.length >= LIMITS[tab];
  const empty = tab === 'mine' ? 'emptyMine' : admin ? 'emptyCompanyAdmin' : 'emptyCompanyMember';
  const heading = editing
    ? t(editing.item ? 'inboxSaved.form.editTitle' : 'inboxSaved.form.addTitle')
    : t('inboxSaved.button');
  const remove = async (item) => {
    const failure = await saved.remove(item);
    if (!failure) setAnnounce(t('inboxSaved.manage.removed'));
    return failure;
  };
  return createPortal(
    <Drawer className="saved-manager" titleId={`${id}-title`} onClose={close}>
      <div className="drawer-top">
        <h2 id={`${id}-title`}>{heading}</h2>
        <Button
          variant="light"
          icon="close"
          aria-label={t('inboxSaved.manage.close')}
          onClick={close}
        />
      </div>
      <div className="drawer-body saved-manager-body">
        {editing ? (
          <SavedReplyForm
            saved={saved}
            editing={editing}
            admin={admin}
            cancelRef={cancelRef}
            onDone={(scope) => {
              if (scope) setTab(scope);
              setEditing(null);
            }}
          />
        ) : (
          <>
            <p className="saved-manager-intro">{t('inboxSaved.manage.intro')}</p>
            <div role="tablist" aria-label={t('inboxSaved.button')} className="saved-manager-tabs">
              {['company', 'mine'].map((name) => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={tab === name}
                  className={'inbox-composer-tab' + (tab === name ? ' is-active' : '')}
                  onClick={() => setTab(name)}
                >
                  {t(`inboxSaved.picker.${name}`)}
                  <span className="saved-manager-count">{saved.data?.[name]?.length ?? 0}</span>
                </button>
              ))}
            </div>
            {canChange ? (
              <div className="saved-manager-tools">
                <small>
                  {t('inboxSaved.manage.count', { count: list.length, limit: LIMITS[tab] })}
                </small>
                <Button
                  icon="plus"
                  disabled={full}
                  title={full ? t('inboxSaved.manage.full') : ''}
                  onClick={() => setEditing({ scope: tab })}
                >
                  {t('inboxSaved.manage.add')}
                </Button>
              </div>
            ) : (
              <p className="saved-manager-note">{t('inboxSaved.manage.readOnly')}</p>
            )}
            {list.length ? (
              <ul className="saved-manager-list" aria-label={t(`inboxSaved.picker.${tab}`)}>
                {list.map((item) => (
                  <SavedReplyRow
                    key={item.id}
                    item={item}
                    company={tab === 'company'}
                    canChange={canChange}
                    onEdit={() => setEditing({ scope: tab, item })}
                    onRemove={() => remove(item)}
                  />
                ))}
              </ul>
            ) : (
              <p className="saved-manager-empty">{t(`inboxSaved.manage.${empty}`)}</p>
            )}
          </>
        )}
        <p className="sr-only" role="status">
          {announce}
        </p>
      </div>
    </Drawer>,
    document.body,
  );
}
