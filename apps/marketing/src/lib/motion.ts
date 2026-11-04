/** Shared Framer Motion settings: one easing curve and the scroll-in rise used by sections. */
export const ease = [0.22, 1, 0.36, 1] as const;

/** Rises into place when scrolled to; stays visible if animations never run. */
export const rise = (delay = 0) => ({
  initial: { y: 36 },
  whileInView: { y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.7, ease, delay },
});
