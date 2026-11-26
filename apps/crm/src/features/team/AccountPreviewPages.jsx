import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTeam } from '../../hooks/useTeam.js';
import { useSession } from '../../hooks/useSession.js';
import { OWNER_ROLE, defaultChannelAccess } from '../../config/team.js';
import { TeamWizard } from './TeamWizard.jsx';
import { AccountFlowLayout } from './AccountFlowLayout.jsx';
import { PasswordFields, PersonFields, PersonReview } from './TeamFields.jsx';
import {
  activateMember,
  checkPreview,
  finishReset,
  setupOwner,
  validateDemoPassword,
  validatePerson,
  verifyEmail,
} from './model.js';
import { Button } from '../../components/ui/Button.jsx';

export function OwnerSetupPage() {
  const { team, error, commit } = useTeam();
  const { user, enterPreview } = useSession();
  const navigate = useNavigate();
  const [started] = React.useState(() => !team.configured && !error);
  const [initial] = React.useState(() => ({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    whatsappUpdates: false,
    roleId: OWNER_ROLE,
    channelAccess: defaultChannelAccess(OWNER_ROLE),
    password: '',
    confirmPassword: '',
  }));
  if (!started || error)
    return (
      <AccountFlowLayout
        title="Workspace setup"
        description="Your team’s ownership is managed from Team & access."
      >
        <div className="team-flow-message">
          <h2>{error ? 'Saved team needs attention' : 'The Super Admin is already set up'}</h2>
          <p>
            {error ||
              'There can only be one active Super Admin. Sign in to manage the existing workspace.'}
          </p>
          <Link to="/team-access">Open Team & access</Link>
        </div>
      </AccountFlowLayout>
    );
  return (
    <AccountFlowLayout
      title="Set up your workspace"
      description="Create the Super Admin profile, then invite your team and assign their access."
    >
      <TeamWizard
        modal={false}
        title="Create your Super Admin account"
        subtitle="The owner controls team accounts, roles and messaging permissions."
        initial={initial}
        steps={[
          {
            id: 'details',
            title: 'Your details',
            validate: (form) =>
              validatePerson(form, team.members, {
                excludeId: team.members.find(
                  (member) => member.email === form.email.trim().toLowerCase(),
                )?.id,
              }),
            render: (props) => <PersonFields {...props} />,
          },
          {
            id: 'password',
            title: 'Password',
            validate: validateDemoPassword,
            render: (props) => <PasswordFields {...props} />,
          },
          {
            id: 'review',
            title: 'Review & create',
            render: ({ form }) => <PersonReview form={form} team={team} owner />,
          },
        ]}
        finishLabel="Create workspace preview"
        onFinish={(form) => {
          let result;
          if (team.configured) {
            const owner = team.members.find(
              (member) =>
                member.roleId === OWNER_ROLE && member.email === form.email.trim().toLowerCase(),
            );
            if (!owner)
              throw Error(
                'Workspace setup was completed elsewhere. Sign in to the existing account.',
              );
            result = { team, memberId: owner.id };
          } else result = commit((current) => setupOwner(current, form, crypto.randomUUID()));
          enterPreview(result.memberId);
          return result;
        }}
        onSuccess={() => navigate('/team-access', { replace: true })}
      />
    </AccountFlowLayout>
  );
}

export function AccountLinkPreviewPage({ kind }) {
  const { team, error, commit } = useTeam();
  const { enterPreview, user } = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [completed, setCompleted] = React.useState(false);
  const snapshot = React.useRef(null);
  let member, failure;
  try {
    if (error) throw Error(error);
    member = completed
      ? snapshot.current
      : checkPreview(team, kind, params.get('id'), params.get('revision'));
    if (!completed) snapshot.current = member;
  } catch (problem) {
    failure = problem.message;
  }
  const title =
    kind === 'invite'
      ? 'Join your team'
      : kind === 'reset'
        ? 'Password reset preview'
        : 'Verify email preview';
  if (failure)
    return (
      <AccountFlowLayout
        title={title}
        description="Account links are available only within this frontend preview."
      >
        <div className="team-flow-message">
          <h2>This link is unavailable</h2>
          <p role="alert">{failure}</p>
          <Link to="/sign-in">Return to sign in</Link>
        </div>
      </AccountFlowLayout>
    );
  if (kind === 'email')
    return (
      <AccountFlowLayout
        title={title}
        description="Review the requested email change before applying it to the demo account."
      >
        <div className="team-flow-message">
          <h2>Confirm your email address</h2>
          <p>
            {member.name} · Current login: {member.email}
          </p>
          <p>
            New login: <strong>{member.pendingEmail.value}</strong>
          </p>
          <p>This button simulates verification; no email has been sent.</p>
          <EmailPreviewAction
            member={member}
            revision={params.get('revision')}
            commit={commit}
            navigate={navigate}
          />
        </div>
      </AccountFlowLayout>
    );
  const initial = { ...member, password: '', confirmPassword: '' };
  const steps =
    kind === 'invite'
      ? [
          {
            id: 'details',
            title: 'Your details',
            validate: (form) => validatePerson(form, team.members, { excludeId: member.id }),
            render: (props) => <PersonFields {...props} readOnlyEmail />,
          },
          {
            id: 'password',
            title: 'Password',
            validate: validateDemoPassword,
            render: (props) => <PasswordFields {...props} />,
          },
          {
            id: 'review',
            title: 'Review & activate',
            render: ({ form }) => <PersonReview form={form} team={team} />,
          },
        ]
      : [
          {
            id: 'password',
            title: 'New password',
            validate: validateDemoPassword,
            render: (props) => <PasswordFields {...props} />,
          },
          {
            id: 'review',
            title: 'Review reset',
            render: () => (
              <div className="team-notice">
                <p>
                  This previews resetting {member.name}’s password. All demo accounts continue to
                  use the public demo password; no password is stored.
                </p>
              </div>
            ),
          },
        ];
  return (
    <AccountFlowLayout
      title={title}
      description={
        kind === 'invite'
          ? `You’re joining as ${team.roles.find((role) => role.id === member.roleId)?.name}. Your Super Admin assigned this access.`
          : 'Create and confirm a password using the public demo details.'
      }
    >
      <TeamWizard
        key={`${kind}-${member.id}`}
        modal={false}
        title={kind === 'invite' ? 'Activate your invitation' : 'Preview a password reset'}
        subtitle={
          kind === 'invite'
            ? 'Add your required phone number before entering the dashboard.'
            : 'Passwords are never visible to your Super Admin.'
        }
        initial={initial}
        steps={steps}
        finishLabel={kind === 'invite' ? 'Activate & open dashboard' : 'Complete reset preview'}
        onFinish={(form) => {
          if (kind === 'invite') {
            if (!completed) {
              commit((current) => activateMember(current, member.id, params.get('revision'), form));
              setCompleted(true);
            }
            enterPreview(member.id);
          } else if (!completed) {
            commit((current) => finishReset(current, member.id, params.get('revision'), form));
            setCompleted(true);
          }
        }}
        onSuccess={() => navigate(kind === 'invite' || user ? '/' : '/sign-in', { replace: true })}
      />
    </AccountFlowLayout>
  );
}

function EmailPreviewAction({ member, revision, commit, navigate }) {
  const [error, setError] = React.useState('');
  return (
    <>
      <Button
        onClick={() => {
          try {
            commit((team) => verifyEmail(team, member.id, revision));
            navigate('/my-profile', { replace: true });
          } catch (failure) {
            setError(failure.message);
          }
        }}
      >
        Confirm email preview
      </Button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
