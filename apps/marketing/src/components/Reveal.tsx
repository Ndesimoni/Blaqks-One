'use client';
import { motion } from 'framer-motion';
import { rise } from '@/lib/motion';

type Props = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: 'div' | 'li' | 'article' | 'figure';
};

/** Rises into place as it scrolls into view; visible even when animations never run. */
export function Reveal({ children, className, delay = 0, as = 'div' }: Props) {
  const Tag = motion[as] as typeof motion.div;
  return (
    <Tag className={className} {...rise(delay)}>
      {children}
    </Tag>
  );
}
