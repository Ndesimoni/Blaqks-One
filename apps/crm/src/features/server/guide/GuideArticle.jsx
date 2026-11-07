import React, { useEffect, useRef } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { GuideItem } from './GuideItem.jsx';
import { readMinutes, relatedGuides } from './guideModel.js';

/**
 * The mockup's article page: back to All guides, the topic and reading time, the title and
 * introduction, where to find it, the numbered steps (or a rule article's points), then Open
 * for its section; related guides beside it. The heading takes focus when it opens.
 */
export function GuideArticle({ guide, list, onOpen, onBack }) {
  const { t } = useI18n();
  const { navigate } = useNavigation();
  const heading = useRef(null);
  useEffect(() => heading.current?.focus(), [guide.id]);
  const Lines = guide.steps ? 'ol' : 'ul';
  return (
    <div className="guide-layout">
      <article className="panel guide-article" aria-labelledby={`guide-${guide.id}`}>
        <button type="button" className="guide-back" onClick={onBack}>
          <Icon name="arrow" size={16} />
          {t('guide.allGuides')}
        </button>
        <span className="guide-meta">
          {guide.topic} · {t('guide.minutes', { count: readMinutes(guide) })}
        </span>
        <h2 id={`guide-${guide.id}`} ref={heading} tabIndex={-1}>
          {guide.title}
        </h2>
        <p className="guide-lead">{guide.intro}</p>
        {guide.path && (
          <div className="guide-where">
            <span>{t('guide.where')}</span>
            {guide.path.map((step, index) => (
              <React.Fragment key={step}>
                {index > 0 && <span aria-hidden="true">›</span>}
                <span className="guide-pill">{step}</span>
              </React.Fragment>
            ))}
          </div>
        )}
        <Lines className={guide.steps ? 'guide-steps' : 'guide-points'}>
          {(guide.steps || guide.points).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </Lines>
        {guide.section && (
          <span>
            <Button icon="arrow" onClick={() => navigate(guide.section)}>
              {t('guide.open', { section: guide.place ?? guide.section })}
            </Button>
          </span>
        )}
      </article>
      <aside className="panel guide-related" aria-label={t('guide.related')}>
        <h3>{t('guide.related')}</h3>
        {relatedGuides(list, guide).map((other) => (
          <GuideItem key={other.id} guide={other} onOpen={onOpen} />
        ))}
      </aside>
    </div>
  );
}
