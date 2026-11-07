import { Reveal } from './Reveal';
import { SecHead } from './SecHead';

const tools: [string, string, string, string][] = [
  ['W', '#25d366', 'WhatsApp', 'Client chats and enquiries'],
  ['G', '#4285f4', 'Google', 'Connect Gmail mailboxes'],
  ['@', '#80603a', 'Company email', 'Send from your own address'],
];
const safety: [string, string][] = [
  ['Private workspaces', 'Each company’s records stay in its own workspace.'],
  ['Roles and permissions', 'Choose who may message, publish or approve payments.'],
  ['Activity history', 'Every change is recorded with who made it and when.'],
  ['Sessions you control', 'See every signed-in device and sign the others out.'],
];

/** Works with, then the security and privacy band. */
export function Trust() {
  return (
    <>
      <section className="sec flush" aria-labelledby="works-title">
        <div className="wrap">
          <SecHead
            tag="Works with"
            id="works-title"
            title="Connects to the tools you already use"
          />
          <div className="works">
            {tools.map(([letter, color, name, line], i) => (
              <Reveal key={name} className="work" delay={i * 0.05}>
                <i style={{ background: color }} aria-hidden="true">
                  {letter}
                </i>
                <span>
                  <b>{name}</b>
                  <small>{line}</small>
                </span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <section className="sec flush" aria-labelledby="secure-title">
        <div className="wrap">
          <Reveal className="secure">
            <div>
              <span className="tag">Security and privacy</span>
              <h2 id="secure-title">Your clients’ details are safe with us</h2>
              <p>Built so client names and numbers are only seen by the people who need them.</p>
            </div>
            <div className="secure-grid">
              {safety.map(([title, text]) => (
                <div key={title}>
                  <b>{title}</b>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
