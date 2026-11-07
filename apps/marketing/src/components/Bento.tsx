'use client';
import { motion } from 'framer-motion';
import { ease } from '@/lib/motion';
import { Icon } from './Icon';
import { Reveal } from './Reveal';
import { SecHead } from './SecHead';
import { Spark } from './Spark';

const leads = [30, 45, 38, 60, 52, 70, 48, 82, 66, 74, 90, 78];
const week: [string, string[]][] = [
  ['Mon', ['', 'g']],
  ['Tue', ['']],
  ['Wed', ['g', '', '']],
  ['Thu', ['g']],
  ['Fri', ['', 'g']],
];

/** The feature grid: six cards of different sizes, each with a small working example. */
export function Bento() {
  return (
    <section className="sec" id="features" aria-labelledby="bento-title">
      <div className="wrap">
        <SecHead
          tag="Everything in one place"
          id="bento-title"
          title="Built for how brokerages really work"
          sub="Four products share the same clients, listings and team, so nothing is typed twice."
        />
        <div className="bento">
          <Reveal className="cell wide">
            <h3>Every enquiry becomes a lead</h3>
            <p>
              WhatsApp, email, website and marketplace enquiries arrive with an owner and a next
              step.
            </p>
            <div className="chip-row">
              <span className="chip g">WhatsApp 42%</span>
              <span className="chip">Website 27%</span>
              <span className="chip">Marketplace 18%</span>
              <span className="chip">Email 13%</span>
            </div>
            <div className="bars">
              {leads.map((h, i) => (
                <motion.div
                  key={i}
                  style={{ height: `${h}%` }}
                  initial={{ scaleY: 0.2 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.04, ease }}
                />
              ))}
            </div>
          </Reveal>
          <Reveal className="cell tall" delay={0.08}>
            <div>
              <h3>From message to lead in one tap</h3>
              <p>
                Turn a WhatsApp chat into a lead with the client, the listing and the agent filled
                in.
              </p>
            </div>
            <div className="funnel">
              <svg viewBox="0 0 150 190" aria-hidden="true">
                <defs>
                  <linearGradient id="funnel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#e4cda5" />
                    <stop offset="1" stopColor="#bc9765" />
                  </linearGradient>
                </defs>
                <path d="M10 20h130l-48 70v60l-34 22V90z" fill="url(#funnel)" />
              </svg>
            </div>
          </Reveal>
          <Reveal className="cell" delay={0.04}>
            <small>Commission this month</small>
            <div className="big">
              AED 128k<small>+21%</small>
            </div>
            <Spark points={[3, 5, 4, 7, 6, 9, 8, 11, 12]} color="var(--gold)" />
            <p>Deals, payments and expenses, approved in the CRM.</p>
          </Reveal>
          <Reveal className="cell" delay={0.08}>
            <h3>Viewings this week</h3>
            <div className="mini-week">
              {week.map(([day, items]) => (
                <div key={day}>
                  {day}
                  {items.map((tone, i) => (
                    <b key={i} className={tone} />
                  ))}
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal className="cell" delay={0.04}>
            <h3>One inbox for clients</h3>
            <div className="msg">
              <span className="dot">LH</span>
              <span>Is the 2-bed in Dubai Marina still available?</span>
            </div>
            <div className="msg">
              <span className="dot">OK</span>
              <span>Can we view the villa on Saturday?</span>
            </div>
          </Reveal>
          <Reveal className="cell" delay={0.08}>
            <h3>Marketplace offers</h3>
            <p>
              Other brokers offer listings for your client. Names stay hidden until the split is
              agreed.
            </p>
            <motion.span
              className="sparkle"
              style={{ right: 26, bottom: 22 }}
              animate={{ scale: [1, 1.25, 1], rotate: [0, 15, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
            >
              <Icon name="spark" size={34} />
            </motion.span>
            <motion.span
              className="sparkle"
              style={{ right: 70, bottom: 58 }}
              animate={{ scale: [1, 0.8, 1] }}
              transition={{ repeat: Infinity, duration: 2.4 }}
            >
              <Icon name="spark" size={16} />
            </motion.span>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
