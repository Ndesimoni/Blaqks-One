import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

/**
 * Header commands offered by sections inside the record slider (approved mockup: Share and
 * Publish on website beside the title, the Website pill beside the status). A section only
 * offers what it would itself allow, so the header never shows an action the section hides.
 */
const PanelCommandsContext = createContext(null);
export const PanelCommandsProvider = PanelCommandsContext.Provider;

/** The slider's command list and the `register(key, command | null)` its sections call. */
export function usePanelCommandList() {
  const [commands, setCommands] = useState({});
  const register = useCallback(
    (key, command) =>
      setCommands((all) => {
        const next = { ...all };
        if (command) next[key] = command;
        else delete next[key];
        return next;
      }),
    [],
  );
  return { commands, register };
}

/**
 * Offers `command` ({ label, name, icon, disabled, pill, tone, run or href }) in the slider
 * header while it is not null; outside a slider it does nothing. `name` is a fuller accessible
 * name; `href` makes it a link. `run` may change on every render.
 */
export function usePanelCommand(key, command) {
  const register = useContext(PanelCommandsContext);
  const run = useRef(null);
  useLayoutEffect(() => {
    run.current = command?.run || null;
  });
  const { label, name, icon, href, disabled = false, pill, tone } = command || {};
  const offered = Boolean(command);
  const runs = Boolean(command?.run);
  useEffect(() => {
    if (!register || !offered) return undefined;
    register(key, {
      label,
      name,
      icon,
      href,
      disabled,
      pill,
      tone,
      run: runs ? () => run.current?.() : null,
    });
    return () => register(key, null);
  }, [register, key, offered, runs, label, name, icon, href, disabled, pill, tone]);
}
