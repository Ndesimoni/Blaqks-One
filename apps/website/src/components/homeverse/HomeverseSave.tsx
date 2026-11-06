'use client';
import { useEffect, useState } from 'react';

export function HomeverseSave({
  id,
  title,
  company,
}: {
  id: string;
  title: string;
  company: string;
}) {
  const key = `blaqks-saved:${company}:${id}`;
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    try {
      setSaved(localStorage.getItem(key) === 'saved');
    } catch {
      /* Saving still works for this visit. */
    }
  }, [key]);
  function toggle() {
    const next = !saved;
    setSaved(next);
    try {
      if (next) localStorage.setItem(key, 'saved');
      else localStorage.removeItem(key);
      setNotice(next ? `${title} saved in this browser.` : `${title} removed from saved homes.`);
    } catch {
      setNotice(
        next
          ? 'Saved for this visit. Browser storage is unavailable.'
          : 'Removed from saved homes.',
      );
    }
  }
  return (
    <>
      <button
        className="v-save"
        type="button"
        aria-label={`${saved ? 'Unsave' : 'Save'} ${title}`}
        aria-pressed={saved}
        onClick={toggle}
        title="Save in this browser"
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill={saved ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M6 3h12v18l-6-4-6 4V3Z" />
        </svg>
      </button>
      <span className="sr-only" role="status">
        {notice}
      </span>
    </>
  );
}
