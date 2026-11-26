import React from 'react';
import { Empty } from '../../../components/ui/Empty.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { GridFilterBar } from '../../records/grid/GridFilterBar.jsx';
import { GuideItem } from './GuideItem.jsx';
import { findGuides, groupGuides, topics } from './guideModel.js';

/**
 * The mockup's guide list: "Search the guide" with All topics, the topics as chips, then the
 * articles grouped by topic. Search matches every word in an article's title, text and path.
 */
export function GuideList({ list, topic, onTopic, query, onQuery, onOpen }) {
  const { t } = useI18n();
  const all = t('guide.allTopics');
  const tabs = [all, ...topics.filter((name) => list.some((guide) => guide.topic === name))];
  const groups = groupGuides(findGuides(list, topic === all ? null : topic, query));
  return (
    <>
      <GridFilterBar
        module={t('guide.module')}
        presetLabel={topic}
        tabs={tabs}
        tab={topic}
        onTab={onTopic}
        query={query}
        onQuery={onQuery}
        placeholder={t('guide.search')}
      />
      {groups.length ? (
        <div className="guide-groups">
          {groups.map((group) => (
            <section key={group.topic} aria-label={group.topic}>
              <h3>{group.topic}</h3>
              <div className="panel guide-list">
                {group.guides.map((guide) => (
                  <GuideItem key={guide.id} guide={guide} onOpen={onOpen} showPath />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Empty icon="search" title={t('guide.none')} detail={t('guide.noneHint')} />
      )}
    </>
  );
}
