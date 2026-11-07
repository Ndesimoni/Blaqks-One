import React from 'react';
import { useTeam } from '../../hooks/useTeam.js';
import { Button } from '../../components/ui/Button.jsx';
import { downloadJson } from '../../services/files/download.js';

export function TeamRecovery() {
  const { error, raw, reload } = useTeam();
  return (
    <section className="panel team-flow-message">
      <h2>Recover your team preview</h2>
      <p role="alert">{error}</p>
      <p>Your CRM records and original saved team data have not been replaced.</p>
      <div className="team-inline-actions">
        <Button onClick={reload}>Retry loading team</Button>
        {raw && (
          <Button
            variant="light"
            onClick={() =>
              downloadJson({ rawTeamData: raw }, 'Keys_with_Simoni_Team_Recovery.json')
            }
          >
            Download saved team data
          </Button>
        )}
      </div>
    </section>
  );
}
