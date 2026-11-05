import { useContext } from 'react';
import {
  RecordsContext,
  PreferencesContext,
  NavigationContext,
  ViewContext,
  ActionsContext,
  CalendarContext,
} from '../app/WorkspaceContext.js';

function useRequiredContext(context, name) {
  const value = useContext(context);
  if (!value) throw Error(`${name} must be used inside WorkspaceProvider.`);
  return value;
}

export const useRecords = () => useRequiredContext(RecordsContext, 'useRecords');
export const usePreferences = () => useRequiredContext(PreferencesContext, 'usePreferences');
export const useNavigation = () => useRequiredContext(NavigationContext, 'useNavigation');
export const useWorkspaceView = () => useRequiredContext(ViewContext, 'useWorkspaceView');
export const useWorkspaceActions = () => useRequiredContext(ActionsContext, 'useWorkspaceActions');
export const useCalendar = () => useRequiredContext(CalendarContext, 'useCalendar');
