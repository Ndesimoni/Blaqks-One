import type { Metadata } from 'next';
import { ContactForm } from '@/components/ContactForm';
import { Reveal } from '@/components/Reveal';
import { SecHead } from '@/components/SecHead';
import { contact } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Tell us about your brokerage. We reply within one working day.',
};

/** Talk to us: the form beside WhatsApp, email and the office. */
export default function ContactPage() {
  return (
    <section className="sec page-top" aria-labelledby="contact-title">
      <div className="wrap">
        <SecHead
          level={1}
          tag="Contact"
          id="contact-title"
          title="Talk to our team"
          sub="Tell us about your brokerage. We reply within one working day."
        />
        <div className="contact">
          <Reveal>
            <ContactForm />
          </Reveal>
          <div className="contact-side">
            <Reveal className="contact-card" delay={0.05}>
              <b>WhatsApp</b>
              <span>{contact.hours}</span>
              <span>{contact.whatsapp}</span>
            </Reveal>
            <Reveal className="contact-card" delay={0.1}>
              <b>Email</b>
              <span>{contact.email}</span>
            </Reveal>
            <Reveal className="contact-card" delay={0.15}>
              <b>Office</b>
              <span>{contact.office}</span>
            </Reveal>
            {contact.sample && (
              <span className="sample" style={{ justifySelf: 'start' }}>
                Sample contact details
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
