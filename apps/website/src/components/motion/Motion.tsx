'use client';
import { usePathname } from 'next/navigation';
import { companyTargets } from '../../lib/motion/targets';
import { useReveal } from './useReveal';

/** Client boundary for the company websites' scroll reveal; renders nothing. */
export function Motion() {
  useReveal(companyTargets, usePathname());
  return null;
}
