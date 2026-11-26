import { useCallback } from 'react';
import { useNavigation, useRecords } from '../../../../hooks/useWorkspace.js';
import { schema } from '../../../../lib/schema.js';

/**
 * Opens an enquiry's lead: Leads, searched by the lead's client ID so it is the row shown.
 * There is no record deep link yet, so the detail opens from that row. `open` returns false
 * when the lead is no longer among this workspace's visible Clients.
 */
export function useOpenLead() {
  const { entries, loading } = useRecords();
  const { navigate } = useNavigation();
  const open = useCallback(
    (leadId) => {
      const entry = (entries?.Clients || []).find((item) => item.id === leadId);
      const clientId = entry?.record?.[schema('Clients')[0].key];
      if (!clientId) return false;
      navigate('Leads', clientId);
      return true;
    },
    [entries, navigate],
  );
  return { open, ready: !loading };
}
