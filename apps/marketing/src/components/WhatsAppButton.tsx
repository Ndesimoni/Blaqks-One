'use client';
import { motion } from 'framer-motion';
import { contact } from '@/lib/site';
import { Icon } from './Icon';

/** The floating chat button. Until the real WhatsApp number is set it opens the contact page. */
export function WhatsAppButton() {
  const href = contact.sample ? '/contact' : `https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`;
  return (
    <motion.a
      className="wa-fab"
      href={href}
      aria-label="Chat with us on WhatsApp"
      title="Chat with us on WhatsApp"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 1, type: 'spring', stiffness: 260, damping: 18 }}
      whileHover={{ scale: 1.06 }}
    >
      <Icon name="chat" size={28} />
    </motion.a>
  );
}
