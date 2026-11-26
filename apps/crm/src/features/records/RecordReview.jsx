import React from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { formatValue } from '../../lib/crm.js';
import { mediaPhotos, mediaPlans } from '../../lib/media.js';
import { useMediaSource } from '../../lib/mediaSource.js';
import { OverflowList } from '../../components/ui/OverflowList.jsx';

export function RecordReview({ module, form, data, sections, onEdit }) {
  const source = useMediaSource();
  return (
    <div className="record-review">
      <p className="review-intro">
        Check your details before saving. Use Edit section to make changes.
      </p>
      {sections.map((section, index) => {
        const entered = section.fields.filter((field) => {
          const value = form[field.key];
          return value !== undefined && value !== null && value !== '';
        });
        const photos = section.media ? mediaPhotos(form) : [];
        const plans = section.media ? mediaPlans(form) : [];
        return (
          <section className="review-section" key={section.id} aria-label={section.title}>
            <div className="review-section-heading">
              <h4>{section.title}</h4>
              <Button
                variant="light"
                aria-label={`Edit section: ${section.title}`}
                onClick={() => onEdit(index)}
              >
                Edit section
              </Button>
            </div>
            {section.media && (
              <div className="review-media">
                <p>
                  {photos.length} photo{photos.length === 1 ? '' : 's'} · {plans.length} floor plan
                  {plans.length === 1 ? '' : 's'}
                </p>
                {!!photos.length && (
                  <OverflowList
                    mode="scroll"
                    className="photo-strip"
                    items={photos}
                    label="Reviewed property photos"
                    listClassName="review-photo-list"
                    renderItem={(photo, photoIndex) => (
                      <img src={source.src(photo, form)} alt={`Property photo ${photoIndex + 1}`} />
                    )}
                  />
                )}
                {!!plans.length && (
                  <ul>
                    {plans.map((plan, planIndex) => (
                      <li key={planIndex}>{plan.name}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {entered.length ? (
              <dl className="record-review-grid">
                {entered.map((field) => (
                  <div key={field.key}>
                    <dt>{field.name}</dt>
                    <dd>
                      {field.name.includes('%')
                        ? `${form[field.key]}%`
                        : formatValue(data, module, form, field)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p>No additional information entered.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
