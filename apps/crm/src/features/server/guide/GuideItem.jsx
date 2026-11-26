import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { readMinutes, topicIcons } from './guideModel.js';

/** One article in a list: its topic mark, title, reading time and, in the list, where it is. */
export function GuideItem({ guide, onOpen, showPath = false }) {
  const { t } = useI18n();
  const minutes = t('guide.minutes', { count: readMinutes(guide) });
  const where = showPath && guide.path ? ` · ${guide.path.join(' › ')}` : '';
  return (
    <button type="button" className="guide-item" onClick={() => onOpen(guide.id)}>
      <span className="guide-dot" aria-hidden="true">
        <Icon name={topicIcons[guide.topic]} size={18} />
      </span>
      <span className="guide-item-text">
        <strong>{guide.title}</strong>
        <span>{minutes + where}</span>
      </span>
    </button>
  );
}
