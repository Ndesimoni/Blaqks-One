import { usePanelCommand } from '../../records/panel/panelCommands.js';
import { useContactCommands } from './useContactCommands.jsx';

/**
 * Call, Email and WhatsApp in the record slider's header for a client or contact, or the client
 * a record is about (the mockup's Call and Message); see `useContactCommands`. Renders only the
 * new email when Email opens one.
 */
export function ContactActions({ module, record }) {
  const { commands, dialog } = useContactCommands({ module, record });
  usePanelCommand('call', commands.call);
  usePanelCommand('email', commands.email);
  usePanelCommand('whatsapp', commands.whatsapp);
  return dialog;
}
