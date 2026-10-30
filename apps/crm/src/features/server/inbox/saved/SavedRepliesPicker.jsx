import React, { useId, useMemo, useState } from 'react';
import { Button } from '../../../../components/ui/Button.jsx';
import { Icon } from '../../../../components/ui/Icon.jsx';
import { OverflowList } from '../../../../components/ui/OverflowList.jsx';
import { useI18n } from '../../../../i18n/useI18n.js';
import { PickerStates } from './PickerStates.jsx';
import { searchReplies } from './savedRepliesModel.js';
import { usePickerKeys } from './usePickerKeys.js';

const SECTIONS = ['company', 'mine'];

/**
 * The picker's content (docs/saved-replies-drafts.md §5): search, then Company and Mine in
 * one continuously scrolling list, then Manage. Focus stays in the search field; the arrow
 * keys move through the list and Enter chooses. Saved text is only ever shown as text.
 */
export function SavedRepliesPicker({ saved, message, onChoose, onClose, onManage }) {
  const { t } = useI18n();
  const id = useId();
  const [query, setQuery] = useState('');
  const items = useMemo(
    () =>
      SECTIONS.flatMap((section) =>
        searchReplies(saved.data?.[section] ?? [], query).map((reply) => ({ ...reply, section })),
      ),
    [saved.data, query],
  );
  const keys = usePickerKeys(items.length, (index) => onChoose(items[index]), onClose);
  const optionId = (index) => `${id}-option-${index}`;
  const none = saved.data && !saved.data.company.length && !saved.data.mine.length;
  const option = ({ item, index }) => (
    <li
      key={`${item.section}-${item.id}`}
      id={optionId(index)}
      role="option"
      aria-selected={keys.active === index}
      className={'saved-picker-option' + (keys.active === index ? ' is-active' : '')}
      onMouseDown={(event) => event.preventDefault()}
      onMouseEnter={() => keys.setActive(index)}
      onClick={() => onChoose(item)}
    >
      <strong>{item.title}</strong>
      <span>{item.body}</span>
    </li>
  );
  const renderList = (entries) => (
    <ul
      id={`${id}-list`}
      role="listbox"
      aria-label={t('inboxSaved.button')}
      className="saved-picker-list"
    >
      {SECTIONS.map((section) => {
        const inSection = entries.filter((entry) => entry.item.section === section);
        if (!inSection.length) return null;
        const label = t(`inboxSaved.picker.${section}`);
        return (
          <li key={section} role="presentation">
            <div className="saved-picker-section" aria-hidden="true">
              {label}
            </div>
            <ul role="group" aria-label={label}>
              {inSection.map(option)}
            </ul>
          </li>
        );
      })}
    </ul>
  );
  return (
    <div className="saved-picker-inner">
      <div className="saved-picker-head">
        <strong>{t('inboxSaved.button')}</strong>
        <button
          type="button"
          className="saved-picker-close"
          aria-label={t('inboxSaved.picker.close')}
          onClick={onClose}
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <input
        type="search"
        className="saved-picker-search"
        role="combobox"
        aria-expanded="true"
        aria-controls={`${id}-list`}
        aria-activedescendant={keys.active >= 0 ? optionId(keys.active) : undefined}
        aria-label={t('inboxSaved.picker.search')}
        placeholder={t('inboxSaved.picker.search')}
        value={query}
        data-picker-search
        onChange={(event) => {
          setQuery(event.target.value);
          keys.setActive(event.target.value.trim() ? 0 : -1);
        }}
        onKeyDown={keys.onKeyDown}
      />
      {message && (
        <p className="saved-picker-note" role="alert">
          {message}
        </p>
      )}
      <PickerStates
        saved={saved}
        none={none}
        query={query}
        matches={items.length}
        onClear={() => setQuery('')}
        onAdd={() => onManage('add')}
      />
      {items.length > 0 && (
        <OverflowList
          mode="scroll"
          items={items}
          label={t('inboxSaved.button')}
          getKey={(item) => `${item.section}-${item.id}`}
          className="saved-picker-scroll"
          renderList={renderList}
        />
      )}
      <div className="saved-picker-foot">
        <Button variant="light" onClick={() => onManage('list')}>
          {t('inboxSaved.picker.manage')}
        </Button>
      </div>
    </div>
  );
}
