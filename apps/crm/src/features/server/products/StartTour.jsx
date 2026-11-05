import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { TOUR_STEPS, tourPlacement, tourTarget } from './tourModel.js';
import './start-tour.css';

/**
 * The start page tour: a bubble beside each part of the app with a gold ring around it, from
 * Home down the sidebar to search. Each rise of `run` starts it again; parts this person cannot
 * see are skipped. Next takes focus; Escape or Skip ends it.
 */
export function StartTour({ run }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(null);
  const [spot, setSpot] = useState(null);
  const next = useRef(null);
  const end = () => setIndex(TOUR_STEPS.length);
  useEffect(() => {
    if (run) setIndex(0);
  }, [run]);
  useEffect(() => {
    if (index === null) return undefined;
    if (index >= TOUR_STEPS.length) {
      setIndex(null);
      setSpot(null);
      return undefined;
    }
    const target = tourTarget(TOUR_STEPS[index]);
    if (!target) {
      setIndex(index + 1);
      return undefined;
    }
    target.classList.add('tour-target');
    const place = () =>
      setSpot({
        key: TOUR_STEPS[index],
        ...tourPlacement(target.getBoundingClientRect(), {
          width: window.innerWidth,
          height: window.innerHeight,
        }),
      });
    const close = (event) => event.key === 'Escape' && end();
    place();
    window.addEventListener('resize', place);
    document.addEventListener('keydown', close);
    return () => {
      target.classList.remove('tour-target');
      window.removeEventListener('resize', place);
      document.removeEventListener('keydown', close);
    };
  }, [index]);
  useEffect(() => {
    if (spot) next.current?.focus();
  }, [spot]);
  if (index === null || index >= TOUR_STEPS.length || !spot) return null;
  const steps = TOUR_STEPS.filter((key) => tourTarget(key));
  const position = steps.indexOf(spot.key) + 1;
  return (
    <div
      className={`start-tour is-${spot.side}`}
      role="dialog"
      aria-labelledby="start-tour-title"
      aria-describedby="start-tour-body"
      style={{ ...spot.style, '--tour-arrow': `${spot.arrow}px` }}
    >
      <strong id="start-tour-title">{t(`start.tour.${spot.key}.title`)}</strong>
      <p id="start-tour-body">{t(`start.tour.${spot.key}.body`)}</p>
      <div className="start-tour-row">
        <span>{t('start.tour.count', { step: position, count: steps.length })}</span>
        <span>
          <button type="button" className="start-tour-skip" onClick={end}>
            {t('start.tour.skip')}
          </button>
          <button
            type="button"
            ref={next}
            className="start-tour-next"
            onClick={() => setIndex(index + 1)}
          >
            {t(position === steps.length ? 'start.tour.done' : 'start.tour.next')}
          </button>
        </span>
      </div>
    </div>
  );
}
