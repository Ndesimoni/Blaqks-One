'use client';
import { motion } from 'framer-motion';
import type { IconName } from '@/lib/products';
import { Icon } from './Icon';

/** Sample brokerage names until real customers agree to be shown; tagged Sample. */
const names: [string, IconName][] = [
  ['Marina Keys Realty', 'logo'],
  ['Palm Crest Homes', 'spark'],
  ['Desert Rose Properties', 'logo'],
  ['Creekside Brokers', 'market'],
  ['Al Noor Estates', 'spark'],
  ['Skyline Lettings', 'logo'],
  ['Gulf Harbour Realty', 'market'],
];

/** A slowly moving strip of brokerage names. */
export function Logos() {
  return (
    <div className="wrap logos">
      <p>Join brokerages across the Emirates already working this way</p>
      <div className="marquee">
        <motion.div
          className="marquee-track"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ repeat: Infinity, ease: 'linear', duration: 32 }}
        >
          {[...names, ...names].map(([name, icon], i) => (
            <span className="logo" key={i} aria-hidden={i >= names.length}>
              <Icon name={icon} />
              {name}
            </span>
          ))}
        </motion.div>
      </div>
      <span className="sample">Sample logos</span>
    </div>
  );
}
