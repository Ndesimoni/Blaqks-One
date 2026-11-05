'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useId, useState } from 'react';
import type { HelpItem } from '@/lib/help';
import { ease } from '@/lib/motion';

/** Questions that open one at a time; the first starts open. */
export function Faq({ items }: { items: HelpItem[] }) {
  const [open, setOpen] = useState(0);
  const id = useId();
  return (
    <div className="faq">
      {items.map((item, i) => (
        <div className="faq-item" key={item.q}>
          <h3>
            <button
              type="button"
              aria-expanded={open === i}
              aria-controls={`${id}-${i}`}
              onClick={() => setOpen(open === i ? -1 : i)}
            >
              {item.q}
              <motion.i animate={{ rotate: open === i ? 45 : 0 }} aria-hidden="true">
                +
              </motion.i>
            </button>
          </h3>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div
                id={`${id}-${i}`}
                className="faq-body"
                key="body"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease }}
              >
                <p>{item.a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
