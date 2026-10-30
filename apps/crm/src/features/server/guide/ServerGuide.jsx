import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { canOpenSection } from '../access.js';
import { guideNotes, guideSteps } from './guideContent.js';
import './guide.css';
import './guide-notes.css';

/** Connected Guide: describes the server-backed product; no browser-local or demo statements. */
export function ServerGuide() {
  const { user } = useSession();
  const { navigate } = useNavigation();
  const steps = guideSteps.filter(([, , , destination]) => canOpenSection(user, destination));
  return (
    <div className="page-stack connected-guide">
      <section className="cg-intro" aria-labelledby="cg-intro-title">
        <h2 id="cg-intro-title">
          Build your business, <em>one relationship at a time.</em>
        </h2>
        <p>
          A workflow from the first introduction to repeat referrals, for the sections you can open.
        </p>
        <span className="cg-intro-count">
          <Icon name="layers" size={15} />
          {steps.length} {steps.length === 1 ? 'step' : 'steps'}
        </span>
      </section>
      <section aria-labelledby="cg-steps-title">
        <h2 id="cg-steps-title" className="cg-section-title">
          Your workflow
        </h2>
        <ol className="cg-steps">
          {steps.map(([n, title, detail, destination, icon]) => (
            <li key={n}>
              <button type="button" className="cg-step" onClick={() => navigate(destination)}>
                <span className="cg-step-top">
                  <span className="cg-step-icon" aria-hidden="true">
                    <Icon name={icon} size={20} />
                  </span>
                  <span className="cg-step-number">Step {n}</span>
                </span>
                <span className="cg-step-title">{title}</span>
                <span className="cg-step-detail">{detail}</span>
                <span className="cg-step-link">
                  Open {destination} <Icon name="arrow" size={15} />
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="cg-notes-title">
        <h2 id="cg-notes-title" className="cg-section-title">
          How access and money work
        </h2>
        <div className="cg-notes">
          {guideNotes.map((note) => (
            <section className="panel cg-note" key={note.title} aria-label={note.title}>
              <h3>
                <span className="cg-note-icon" aria-hidden="true">
                  <Icon name={note.icon} size={18} />
                </span>
                {note.title}
              </h3>
              <ul>
                {note.points.map((point) => (
                  <li key={point}>
                    <Icon name="check" size={15} />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
