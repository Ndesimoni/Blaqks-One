import React, { useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { GuideArticle } from './GuideArticle.jsx';
import { GuideList } from './GuideList.jsx';
import { visibleGuides } from './guideModel.js';
import '../../records/grid/grid-filter.css';
import './guide.css';

/**
 * Connected Guide as the approved mockup's (design queue item 13): searchable articles grouped
 * by topic, each opening as an article with its steps and related guides. Articles describe the
 * server-backed product only, and only sections the person can open.
 */
export function ServerGuide() {
  const { t } = useI18n();
  const { user } = useSession();
  const list = visibleGuides(user);
  const [topic, setTopic] = useState(() => t('guide.allTopics'));
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(null);
  const guide = list.find((item) => item.id === open);
  return (
    <div className="page-stack connected-guide">
      {guide ? (
        <GuideArticle guide={guide} list={list} onOpen={setOpen} onBack={() => setOpen(null)} />
      ) : (
        <GuideList
          list={list}
          topic={topic}
          onTopic={setTopic}
          query={query}
          onQuery={setQuery}
          onOpen={setOpen}
        />
      )}
    </div>
  );
}
