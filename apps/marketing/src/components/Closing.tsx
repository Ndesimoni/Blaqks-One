'use client';
import { motion } from 'framer-motion';
import { ease } from '@/lib/motion';
import { links } from '@/lib/site';
import { Arrow } from './Arrow';
import { Dashboard } from './Dashboard';
import { Reveal } from './Reveal';

/** The closing call to action: Start free beside the dashboard. */
export function Closing() {
  return (
    <section className="sec flush" aria-labelledby="closing-title">
      <div className="wrap">
        <Reveal className="closing">
          <div>
            <span className="tag">Get started</span>
            <h2 id="closing-title">Run your brokerage from one place</h2>
            <p>Free for your first three seats. No card needed.</p>
            <div className="email-row">
              <a className="btn btn-gold" href={links.signUp}>
                Start free <Arrow />
              </a>
              <a className="btn btn-dark" href="/contact">
                Talk to us <Arrow />
              </a>
            </div>
          </div>
          <motion.div
            initial={{ x: 40 }}
            whileInView={{ x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease }}
          >
            <Dashboard />
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}
