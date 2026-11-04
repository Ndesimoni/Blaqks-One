'use client';
import { motion } from 'framer-motion';
import { ease } from '@/lib/motion';

/** The privacy example: a floating shield with who sees what and the activity record. */
export function ShieldArt() {
  return (
    <div className="row-art">
      <div className="ring" />
      <motion.div
        className="shield"
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
      >
        <svg viewBox="0 0 130 150" aria-hidden="true">
          <defs>
            <linearGradient id="shield" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" style={{ stopColor: 'var(--shield-a)' }} />
              <stop offset="1" style={{ stopColor: 'var(--shield-b)' }} />
            </linearGradient>
          </defs>
          <path d="M65 6l52 20v40c0 36-24 62-52 76C37 128 13 102 13 66V26z" fill="url(#shield)" />
          <path
            d="M42 74l16 16 30-34"
            fill="none"
            style={{ stroke: 'var(--shield-tick)' }}
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </motion.div>
      <div className="float-card" style={{ left: 24, top: 28 }}>
        <b>Reem Aziz</b>
        <small>Sees 24 assigned clients</small>
      </div>
      <div className="float-card" style={{ left: 40, bottom: 30 }}>
        <b>Activity</b>
        <small>Aidah published Marina Gate · 10:42</small>
      </div>
    </div>
  );
}

/** The publishing example: a gold listing card that tilts into place, switched on. */
export function ListingArt() {
  return (
    <div className="row-art">
      <div className="ring left" />
      <motion.div
        className="gold-card"
        initial={{ rotate: -14, y: 30 }}
        whileInView={{ rotate: -8, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease }}
      >
        <div className="top">
          <b>Marina Gate · 2-bed</b>
          <span className="sw" aria-hidden="true" />
        </div>
        <div>
          <div className="price-big">AED 190,000/yr</div>
          <small>Live on your website and the Blaqks One site</small>
        </div>
      </motion.div>
    </div>
  );
}

/** The marketplace example: a client request and an offer with the agreed split. */
export function OffersArt() {
  return (
    <div className="row-art">
      <div className="offer-stack">
        <motion.div
          className="offer"
          initial={{ x: 30 }}
          whileInView={{ x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease }}
        >
          <b>2-bed, Dubai Marina</b>
          <div className="offer-row">
            <span>Rent · AED 170–200k</span>
            <span className="chip g">2 offers</span>
          </div>
        </motion.div>
        <motion.div
          className="offer"
          initial={{ x: 60 }}
          whileInView={{ x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease, delay: 0.1 }}
        >
          <b>Offer from Cedar Estates</b>
          <div className="offer-row">
            <span>Marina Gate · AED 185,000/yr</span>
            <span>Split 50 / 50</span>
          </div>
          <div className="split">
            <span />
            <span />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/** The messages example: a short WhatsApp conversation. */
export function ChatArt() {
  return (
    <div className="row-art chat-art">
      <div className="msg">
        <span className="dot">LH</span>
        <span>Hi, is the 2-bed in Dubai Marina still available?</span>
      </div>
      <div className="msg mine">
        <span>Yes. Would Thursday at 4 pm suit you for a viewing?</span>
      </div>
      <div className="msg">
        <span className="dot">LH</span>
        <span>Thursday works. Thank you!</span>
      </div>
    </div>
  );
}
