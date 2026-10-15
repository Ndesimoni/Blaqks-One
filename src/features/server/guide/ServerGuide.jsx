import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { canOpenSection } from '../access.js';
import { guideNotes, guideSteps } from './guideContent.js';

/** Connected Guide: describes the server-backed product; no browser-local or demo statements. */
export function ServerGuide() {
  const { user } = useSession();
  const { navigate } = useNavigation();
  const steps = guideSteps.filter(([, , , destination]) => canOpenSection(user, destination));
  return (
    <div className="page-stack">
      <div className="guide-hero">
        <div className="eyebrow">GETTING STARTED</div>
        <h1>
          Build your business,
          <br />
          <em>one relationship at a time.</em>
        </h1>
        <p>
          A workflow from the first introduction to repeat referrals, for the sections you can open.
        </p>
      </div>
      <div className="guide-grid">
        {steps.map(([n, title, detail, destination, icon]) => (
          <button className="guide-card" key={n} onClick={() => navigate(destination)}>
            <div className="guide-top">
              <span>{n}</span>
              <Icon name={icon} size={22} />
            </div>
            <h3>{title}</h3>
            <p>{detail}</p>
            <div>
              Open {destination} <Icon name="arrow" size={15} />
            </div>
          </button>
        ))}
      </div>
      <div className="two-grid">
        {guideNotes.map((note) => (
          <section className="panel" key={note.title} aria-label={note.title}>
            <h2>{note.title}</h2>
            <ul>
              {note.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
