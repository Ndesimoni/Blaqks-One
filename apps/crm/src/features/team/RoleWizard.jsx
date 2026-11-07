import React from 'react';
import { useSession } from '../../hooks/useSession.js';
import { useTeam } from '../../hooks/useTeam.js';
import { permissionFields } from '../../config/team.js';
import { saveRole } from './model.js';
import { TeamWizard } from './TeamWizard.jsx';
import { TeamField, RoleSummary } from './TeamFields.jsx';
import { OverflowList } from '../../components/ui/OverflowList.jsx';

export function RoleWizard({ role, onClose, onSuccess }) {
  const { team, commit } = useTeam();
  const { user } = useSession();
  const initial = role
    ? { ...role, permissions: { ...role.permissions } }
    : {
        name: '',
        description: '',
        permissions: { ...team.roles.find((entry) => entry.id === 'staff').permissions },
      };
  return (
    <TeamWizard
      title={role ? 'Edit custom role' : 'Create custom role'}
      subtitle="Choose the CRM sections this role can manage. Client messaging is granted per member."
      initial={initial}
      steps={[
        {
          id: 'name',
          title: 'Role details',
          validate: (form) =>
            !form.name.trim()
              ? { name: 'Enter a role name.' }
              : team.roles.some(
                    (entry) =>
                      entry.id !== role?.id &&
                      entry.name.toLowerCase() === form.name.trim().toLowerCase(),
                  )
                ? { name: 'This role name is already in use.' }
                : {},
          render: ({ form, change, errors }) => (
            <div className="team-fields">
              <TeamField
                label="Role name"
                required
                value={form.name}
                error={errors.name}
                onChange={(value) => change('name', value)}
              />
              <TeamField
                label="Description"
                value={form.description}
                onChange={(value) => change('description', value)}
              />
            </div>
          ),
        },
        {
          id: 'access',
          title: 'CRM permissions',
          render: ({ form, change }) => (
            <div className="team-fields">
              <OverflowList
                items={permissionFields}
                getKey={(item) => item.key}
                label="CRM permission options"
                className="overflow-permissions"
                renderItem={({ key, label, detail }) => (
                  <label className="team-check">
                    <input
                      type="checkbox"
                      checked={form.permissions[key]}
                      onChange={(event) =>
                        change('permissions', { ...form.permissions, [key]: event.target.checked })
                      }
                    />
                    <span>
                      <strong>{label}</strong>
                      <small>{detail}</small>
                    </span>
                  </label>
                )}
              />
              <p className="team-muted">
                Imports and exports include the full CRM dataset. Reports can include financial
                summaries. Team management stays exclusive to the Super Admin.
              </p>
            </div>
          ),
        },
        { id: 'review', title: 'Review role', render: ({ form }) => <RoleSummary role={form} /> },
      ]}
      finishLabel={role ? 'Save role' : 'Create role'}
      onClose={onClose}
      onFinish={(form) =>
        commit((current) => saveRole(current, user.id, form, role?.id || crypto.randomUUID()))
      }
      onSuccess={onSuccess}
    />
  );
}
