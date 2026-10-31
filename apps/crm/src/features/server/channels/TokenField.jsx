import React, { useState } from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { ChannelField, described } from './ChannelField.jsx';

/**
 * A write-only secret with a show/hide toggle. The toggle's name says what it will do, and
 * the value stays in the form's own state; it is never prefilled or stored in the browser.
 */
export function TokenField({ id, label, hint, error, value, inputRef, labels, onChange }) {
  const [visible, setVisible] = useState(false);
  const action = visible ? labels.hide : labels.show;
  return (
    <ChannelField id={id} label={label} hint={hint} error={error}>
      <div className="channel-secret">
        <input
          id={id}
          ref={inputRef}
          className="u-ltr"
          type={visible ? 'text' : 'password'}
          value={value}
          maxLength={200}
          autoComplete="new-password"
          autoCapitalize="off"
          spellCheck={false}
          {...described(id, hint, error)}
          onChange={onChange}
        />
        <button
          type="button"
          className="channel-reveal"
          aria-label={action}
          title={action}
          aria-controls={id}
          onClick={() => setVisible((current) => !current)}
        >
          <Icon name={visible ? 'eye-off' : 'eye'} size={18} />
        </button>
      </div>
    </ChannelField>
  );
}
