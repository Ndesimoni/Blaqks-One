import React, { useId } from 'react';
import { useSession } from '../../../../hooks/useSession.js';
import { useI18n } from '../../../../i18n/useI18n.js';
import { isReady, profileName } from './publishModel.js';
import { ReadinessList } from './ReadinessList.jsx';

function siteNotice(publishers) {
  if (!publishers.admin) return '';
  if (!publishers.site) return 'siteMissing';
  return publishers.site.licenceVerified ? '' : 'errorLicence';
}

/**
 * Who represents the listing and where it appears. An Admin chooses among eligible profiles;
 * staff publish only as themselves. Company-only needs an active, entitled company site,
 * which only the Admin can read; staff use the shared default and the server decides.
 */
export function PublishAgentStep({ flow, publishers }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`websitePublish.${key}`, vars);
  const { user } = useSession();
  const id = useId();
  const { draft, errors, change } = flow;
  const site = publishers.site;
  const companyOnly = publishers.admin && Boolean(site?.active && site?.entitled);
  const own = publishers.eligible.find((profile) => profile.member === user.id);
  const label = (profile) =>
    profile.member === user.id
      ? k('agentYou', { name: profileName(profile) || user.name })
      : profileName(profile);
  const notice = siteNotice(publishers);
  const described = [`${id}-hint`, errors.agent ? `${id}-error` : ''].filter(Boolean).join(' ');
  return (
    <>
      {flow.fixed && flow.entry && !isReady(flow.entry.record) && (
        <ReadinessList entry={flow.entry} invalid={errors.property === 'notReady'} />
      )}
      {notice && (
        <p className="website-publish-note is-warning" role="note">
          {k(notice)}
        </p>
      )}
      {publishers.admin && publishers.eligible.length > 0 && (
        <div className="field">
          <label htmlFor={`${id}-agent`}>
            {k('agent')}
            <span className="required"> *</span>
          </label>
          <select
            id={`${id}-agent`}
            value={draft.agentProfileId}
            aria-invalid={Boolean(errors.agent)}
            aria-describedby={described}
            onChange={(event) => change({ agentProfileId: event.target.value })}
          >
            {publishers.eligible.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {label(profile)}
              </option>
            ))}
          </select>
          <small id={`${id}-hint`} className="finance-hint">
            {k('agentHint')}
          </small>
        </div>
      )}
      {!publishers.admin && own && (
        <div className="website-publish-you">
          <span>{k('agent')}</span>
          <strong>{label(own)}</strong>
        </div>
      )}
      {!publishers.eligible.length && (
        <p className="website-publish-note is-warning" role="note">
          {k(publishers.admin ? 'noAgentsAdmin' : 'noAgentsStaff')}
        </p>
      )}
      {errors.agent && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {k('chooseAgent')}
        </p>
      )}
      <fieldset className="website-destination">
        <legend>{k('destination')}</legend>
        <label>
          <input
            type="radio"
            name={`${id}-destination`}
            checked={draft.destination === 'general_and_company'}
            onChange={() => change({ destination: 'general_and_company' })}
          />
          <span>
            <strong>{k('destinationBoth')}</strong>
            <small>{k('destinationBothHint')}</small>
          </span>
        </label>
        <label className={companyOnly ? '' : 'is-disabled'}>
          <input
            type="radio"
            name={`${id}-destination`}
            checked={draft.destination === 'company_only'}
            disabled={!companyOnly}
            aria-describedby={`${id}-only`}
            onChange={() => change({ destination: 'company_only' })}
          />
          <span>
            <strong>{k('destinationCompany')}</strong>
            <small id={`${id}-only`}>
              {k(
                companyOnly
                  ? 'destinationCompanyHint'
                  : publishers.admin
                    ? 'needsCompanySite'
                    : 'companyOnlyAdmin',
              )}
            </small>
          </span>
        </label>
      </fieldset>
    </>
  );
}
