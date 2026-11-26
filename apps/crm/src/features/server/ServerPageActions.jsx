import React from 'react';
import { useNavigation } from '../../hooks/useWorkspace.js';
import { ServerImportAction } from './ServerImportAction.jsx';
import { ViewOnlyChip } from './ViewOnlyChip.jsx';
import { isRecordSection } from './sectionStatus.js';

/**
 * A record page's scoped actions above its content: the View only chip and Import. The page's
 * name sits in the top bar (NAV5), so pages without these actions start with their own tools.
 */
export function ServerPageActions({ owner }) {
  const { route } = useNavigation();
  const supported = isRecordSection(route);
  if (!supported && route !== 'Team & access') return null;
  return (
    <div className="page-actions">
      {supported && <ViewOnlyChip module={route} />}
      <ServerImportAction owner={owner} />
    </div>
  );
}
