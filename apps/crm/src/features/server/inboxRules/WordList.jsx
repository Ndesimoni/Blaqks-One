import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { addWord, isArabic } from './useInboxRules.js';

/** English and Arabic property words as removable chips, with one field to add more. */
export function WordList({ draft, onChange }) {
  const { t } = useI18n();
  const id = useId();
  const [word, setWord] = useState('');
  const add = (event) => {
    event.preventDefault();
    const key = isArabic(word) ? 'wordsAr' : 'wordsEn';
    onChange({ ...draft, [key]: addWord(draft[key], word) });
    setWord('');
  };
  const remove = (key, value) =>
    onChange({ ...draft, [key]: draft[key].filter((item) => item !== value) });
  const chips = (key, lang) =>
    draft[key].map((value) => (
      <li key={`${key}-${value}`}>
        <bdi lang={lang}>{value}</bdi>
        <button
          type="button"
          aria-label={t('inboxRules.words.remove', { word: value })}
          onClick={() => remove(key, value)}
        >
          ×
        </button>
      </li>
    ));
  return (
    <div className="rules-words">
      <ul className="rules-chips" aria-label={t('inboxRules.words.list')}>
        {chips('wordsEn', 'en')}
        {chips('wordsAr', 'ar')}
      </ul>
      <div className="rules-add">
        <label htmlFor={`${id}-word`} className="sr-only">
          {t('inboxRules.words.add')}
        </label>
        <input
          id={`${id}-word`}
          value={word}
          maxLength={60}
          placeholder={t('inboxRules.words.placeholder')}
          onChange={(event) => setWord(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && add(event)}
        />
        <Button variant="light" icon="plus" disabled={!word.trim()} onClick={add}>
          {t('inboxRules.words.add')}
        </Button>
      </div>
    </div>
  );
}
