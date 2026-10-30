import React from 'react';
import { useTeam } from '../../hooks/useTeam.js';
import { useSession } from '../../hooks/useSession.js';
import { OWNER_ROLE, defaultChannelAccess } from '../../config/team.js';
import { editMember, inviteMember, validatePerson } from './model.js';
import { TeamWizard } from './TeamWizard.jsx';
import { PersonFields, PersonReview, RoleAccessFields } from './TeamFields.jsx';

export function MemberWizard({ member, onClose, onSuccess }) {
  const { team, commit } = useTeam();
  const { user } = useSession();
  const inviting = !member;
  const canAssign = user.managesTeam && member?.roleId !== OWNER_ROLE;
  const initial = member
    ? {
        ...member,
        email: member.pendingEmail?.value || member.email,
        channelAccess: { ...member.channelAccess },
      }
    : {
        name: '',
        email: '',
        phone: '',
        roleId: 'staff',
        channelAccess: defaultChannelAccess('staff'),
        whatsappUpdates: false,
      };
  const steps = [
    {
      id: 'details',
      title: 'Personal details',
      validate: (form) =>
        validatePerson(form, team.members, {
          excludeId: member?.id,
          phoneRequired: !inviting && ['active', 'suspended'].includes(member.status),
        }),
      render: (props) => (
        <>
          <PersonFields
            {...props}
            phone={!inviting}
            phoneRequired={['active', 'suspended'].includes(member?.status)}
          />
          {!inviting && (
            <p className="team-muted">
              Email changes for active accounts stay pending until the verification preview is
              completed.
            </p>
          )}
          {inviting && (
            <p className="team-muted">
              The member enters their required phone number when they activate this invitation.
            </p>
          )}
        </>
      ),
    },
  ];
  if (inviting || canAssign)
    steps.push({
      id: 'access',
      title: 'Role & messaging',
      render: (props) => <RoleAccessFields {...props} team={team} />,
    });
  steps.push({
    id: 'review',
    title: 'Review & save',
    render: ({ form }) => <PersonReview form={form} team={team} invitation={inviting} />,
  });
  return (
    <TeamWizard
      title={inviting ? 'Invite team member' : 'Edit member profile'}
      subtitle={
        inviting
          ? 'Choose the person’s role and grant each client messaging channel separately.'
          : 'Update contact details and review the assigned access.'
      }
      initial={initial}
      steps={steps}
      finishLabel={inviting ? 'Create invitation preview' : 'Save member'}
      onClose={onClose}
      onFinish={(form) =>
        commit((current) =>
          inviting
            ? inviteMember(current, user.id, form, crypto.randomUUID())
            : editMember(current, user.id, member.id, form),
        )
      }
      onSuccess={onSuccess}
    />
  );
}
