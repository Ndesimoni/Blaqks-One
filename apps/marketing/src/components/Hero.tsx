'use client';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { ease } from '@/lib/motion';
import { links } from '@/lib/site';
import { Arrow } from './Arrow';
import { Dashboard } from './Dashboard';
import { Mesh } from './Mesh';

/**
 * The hero, as the approved design: the line mesh, a centred headline and two buttons, then
 * the gold-rimmed arc with the CRM dashboard rising and flattening as the page scrolls.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const rotateX = useTransform(scrollYProgress, [0, 0.45], [32, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.45], [0.86, 1]);
  const y = useTransform(scrollYProgress, [0, 0.45], [40, -150]);
  const arcY = useTransform(scrollYProgress, [0, 0.6], [0, 140]);
  const glow = useTransform(scrollYProgress, [0, 0.5], [1, 0.55]);
  const step = (delay: number) => ({
    initial: { opacity: 0, y: 20, filter: 'blur(6px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.8, ease, delay },
  });
  return (
    <section className="hero" ref={ref} aria-labelledby="hero-title">
      <Mesh host={ref} />
      <div className="wrap hero-copy">
        <motion.a className="tag" href="/products/marketplace" {...step(0)}>
          <span className="chip g">New</span>The broker marketplace is open ›
        </motion.a>
        <motion.h1 id="hero-title" {...step(0.1)}>
          The workspace for <span>UAE real estate</span> teams.
        </motion.h1>
        <motion.p className="hero-sub" {...step(0.2)}>
          Leads, listings, your company website, the broker marketplace and every client message,
          together in one place.
        </motion.p>
        <motion.div className="hero-btns" {...step(0.3)}>
          <a className="btn btn-dark" href="#features">
            See how it works <Arrow />
          </a>
          <a className="btn btn-gold" href={links.signUp}>
            Start free <Arrow />
          </a>
        </motion.div>
      </div>
      <div className="stage">
        <motion.div
          className="planet"
          style={{ y: arcY, opacity: glow }}
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.4, ease }}
        />
        <motion.div
          className="dash-holder"
          style={{ rotateX, scale, y }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.35 }}
        >
          <Dashboard />
        </motion.div>
      </div>
    </section>
  );
}
