import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';

/**
 * A contact command (Call, Message) in a record slider or the Client desk: a button, or
 * a link when it has `href`. A web link opens in a new tab, a `tel:` link in the phone app.
 */
export function ContactCommand({ command }) {
  if (!command.href)
    return (
      <Button
        variant="light"
        icon={command.icon}
        aria-label={command.name}
        title={command.name}
        disabled={command.disabled}
        onClick={command.run}
      >
        {command.label}
      </Button>
    );
  return (
    <a
      className="btn btn-light"
      href={command.href}
      target={command.href.startsWith('https:') ? '_blank' : undefined}
      rel="noopener noreferrer"
      aria-label={command.name}
      title={command.name}
    >
      <Icon name={command.icon} size={16} aria-hidden="true" />
      <span>{command.label}</span>
    </a>
  );
}
