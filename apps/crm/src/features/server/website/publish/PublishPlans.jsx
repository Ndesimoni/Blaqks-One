import React, { useId } from 'react';
import { Icon } from '../../../../components/ui/Icon.jsx';
import { useI18n } from '../../../../i18n/useI18n.js';
import { useMediaSource } from '../../../../lib/mediaSource.js';
import { MAX_PLANS, isPdf, planChoices, toggle } from './publishModel.js';

/** Up to three image floor plans; PDF plans are listed as private and cannot be chosen. */
export function PublishPlans({ flow }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`websitePublish.${key}`, vars);
  const source = useMediaSource();
  const id = useId();
  const { draft, change } = flow;
  const record = flow.entry?.record;
  const plans = planChoices(record);
  if (!plans.length) return null;
  return (
    <section className="website-media" aria-labelledby={`${id}-title`}>
      <div className="website-media-head">
        <h4 id={`${id}-title`}>{k('plans')}</h4>
        <p aria-live="polite">
          {k('planCount', { count: draft.floorPlans.length, max: MAX_PLANS })}
        </p>
      </div>
      <ul className="website-photo-grid website-plan-grid">
        {plans.map((plan, index) => {
          if (isPdf(plan))
            return (
              <li key={plan.file} className="website-plan-private">
                <Icon name="lock" size={16} />
                <span>
                  <strong>{k('planNumber', { number: index + 1 })}</strong>
                  <small>{k('pdfPrivate')}</small>
                </span>
              </li>
            );
          const selected = draft.floorPlans.includes(plan.file);
          return (
            <li key={plan.file} className={selected ? 'is-selected' : ''}>
              <button
                type="button"
                className="website-photo-toggle"
                aria-pressed={selected}
                aria-label={k(selected ? 'planSelected' : 'planUnselected', {
                  number: index + 1,
                })}
                onClick={() =>
                  change({ floorPlans: toggle(draft.floorPlans, plan.file, MAX_PLANS) })
                }
              >
                <img src={source.src(plan, record)} alt="" loading="lazy" />
                <span className="website-photo-mark" aria-hidden="true">
                  {selected ? <Icon name="check" size={14} /> : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
