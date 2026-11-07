'use client';
import { useEffect } from 'react';
import { armReveal } from '../../lib/motion/reveal';

/**
 * Arm the scroll reveal after hydration and again after each client navigation (`key`).
 * The frame wait lets the router finish restoring the scroll position first.
 */
export function useReveal(selector: string, key: string) {
  useEffect(() => {
    let dispose = () => {};
    const frame = requestAnimationFrame(() => {
      dispose = armReveal(document, selector);
    });
    return () => {
      cancelAnimationFrame(frame);
      dispose();
    };
  }, [selector, key]);
}
