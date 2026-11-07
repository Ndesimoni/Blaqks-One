import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { InlineConfirm } from './InlineConfirm.jsx';

/**
 * The Website profile card footer: the saved or unsaved state, then Discard and Save, or the
 * inline question before consent is withdrawn.
 */
export function WebsiteProfileSectionFoot(props) {
  const { status, changed, confirming, busy, live, onConfirm, onCancel, onReset, t } = props;
  const k = (key, vars) => t(`websiteTeam.own.${key}`, vars);
  return (
    <div className="acct-card-foot">
      <div className="acct-foot-status">
        <div aria-live="polite">
          {status && (
            <p className="acct-success">
              <Icon name="check" size={15} />
              {status}
            </p>
          )}
        </div>
        {!status && changed && !confirming && <p className="acct-muted">{k('unsaved')}</p>}
      </div>
      {confirming ? (
        <InlineConfirm
          label={k('offLabel')}
          prompt={k('offPrompt', { count: live })}
          confirmLabel={k('offConfirm')}
          busy={busy}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      ) : (
        <div className="acct-actions">
          <Button variant="light" disabled={busy || !changed} onClick={onReset}>
            {k('discard')}
          </Button>
          <Button
            type="submit"
            className={busy ? 'acct-loading' : ''}
            disabled={busy || !changed}
            aria-busy={busy}
          >
            {busy ? k('saving') : k('save')}
          </Button>
        </div>
      )}
    </div>
  );
}
