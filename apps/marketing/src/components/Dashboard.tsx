'use client';
import { motion } from 'framer-motion';
import { ease } from '@/lib/motion';
import { Icon } from './Icon';
import { Spark } from './Spark';

const kpis = [
  ['New leads', '48', '+18% on last month', [4, 6, 5, 8, 7, 10, 12], 'var(--gold)'],
  ['Viewings booked', '31', '9 this week', [3, 4, 6, 5, 7, 6, 9], 'var(--leaf-2)'],
  ['Deals in progress', 'AED 14.2M', '12 deals', [6, 7, 6, 9, 8, 11, 12], 'var(--gold)'],
  ['Commission', 'AED 128,400', '+AED 22,000', [2, 3, 5, 4, 6, 8, 9], 'var(--leaf-2)'],
] as const;
const today = [
  ['Viewing · Marina Gate 2-bed', '4:00 pm', ''],
  ['Call Layla Haddad', '5:30 pm', 'g'],
  ['Offer due · Business Bay office', '6:00 pm', ''],
  ['New WhatsApp enquiry', 'now', 'g'],
];
const weeks = [42, 64, 50, 78, 58, 92, 70, 84];

/** The CRM's start page drawn in the page, with fictional figures. */
export function Dashboard() {
  return (
    <div
      className="dash"
      role="img"
      aria-label="The Blaqks One CRM start page with fictional figures"
    >
      <div className="dash-top">
        <span className="wordmark">
          Blaqks One
          <i />
        </span>
        <div className="dash-tabs">
          <span className="on">
            <Icon name="home" size={14} />
            Home
          </span>
          <span>
            <Icon name="crm" size={14} />
            CRM
          </span>
          <span>
            <Icon name="web" size={14} />
            Websites
          </span>
          <span>
            <Icon name="market" size={14} />
            Marketplace
          </span>
          <span>
            <Icon name="chat" size={14} />
            Messages
          </span>
        </div>
        <div className="dash-me">
          <Icon name="bell" />
          <span className="avatar">AS</span>
        </div>
      </div>
      <div className="dash-body">
        <div className="dash-title">
          <h4>Good morning, Aidah</h4>
          <span>This month</span>
        </div>
        <div className="kpis">
          {kpis.map(([label, value, note, points, color]) => (
            <div className="kpi" key={label}>
              <small>{label}</small>
              <b>{value}</b>
              <em>{note}</em>
              <Spark points={[...points]} color={color} />
            </div>
          ))}
        </div>
        <div className="dash-row">
          <div className="panel-d">
            <h5>Leads by week</h5>
            <div className="bars">
              {weeks.map((h, i) => (
                <motion.div
                  key={i}
                  style={{ height: `${h}%` }}
                  initial={{ scaleY: 0.25 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease, delay: 0.05 * i }}
                />
              ))}
            </div>
            <div className="axis">
              {weeks.map((_, i) => (
                <span key={i}>W{i + 1}</span>
              ))}
            </div>
          </div>
          <div className="panel-d">
            <h5>Today</h5>
            <div className="today">
              {today.map(([what, when, tone]) => (
                <div key={what}>
                  <i className={tone} />
                  {what}
                  <span>{when}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
