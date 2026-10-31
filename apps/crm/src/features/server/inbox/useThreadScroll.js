import { useEffect, useRef } from 'react';

/**
 * Keeps the thread at its newest item (E1c/E1d): after layout settles, at once when a
 * conversation opens and smoothly when an item arrives; and when its size changes (a phone
 * rotating, the composer growing) while it was already at the bottom. Only the thread
 * scrolls, never the page. Returns the thread's scroll handler.
 */
export function useThreadScroll(box, data) {
  const opened = useRef('');
  const pinned = useRef(true);
  // A thread already at its newest item stays there when its size changes (a phone
  // rotating, the composer growing), so the last message never hides under the composer.
  useEffect(() => {
    const thread = box.current;
    if (!thread || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      if (pinned.current) thread.scrollTop = thread.scrollHeight;
    });
    observer.observe(thread);
    return () => observer.disconnect();
  }, []);
  // Scroll only the thread to its newest item, never the page around it, once layout has
  // settled: at once when a conversation opens, smoothly when a new item arrives.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const thread = box.current;
      if (!thread) return;
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const fresh = opened.current !== data.conversation.id;
      opened.current = data.conversation.id;
      const behavior = fresh || reduced ? 'auto' : 'smooth';
      thread.scrollTo?.({ top: thread.scrollHeight, behavior });
    });
    return () => cancelAnimationFrame(frame);
  }, [data.conversation.id, data.messages.length, data.notes.length]);
  return (event) => {
    const thread = event.currentTarget;
    pinned.current = thread.scrollTop + thread.clientHeight >= thread.scrollHeight - 40;
  };
}
