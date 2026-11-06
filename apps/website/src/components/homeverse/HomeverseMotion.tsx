'use client';
import { useEffect } from 'react';
export function HomeverseMotion() {
  useEffect(() => {
    if (
      matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !('IntersectionObserver' in window)
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.animate(
              [
                { opacity: 0, transform: 'translateY(12px)' },
                { opacity: 1, transform: 'none' },
              ],
              { duration: 450, easing: 'ease-out' },
            );
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.12 },
    );
    document
      .querySelectorAll('.v-lifestyle, .v-benefits, .v-about, .v-advisors')
      .forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
  return null;
}
