//! Sample staff accounts: created active in the Admin's team, reactivated by a later
//! seed after `clear-sample` suspended them (see `clear::suspend`). Accounts an Admin
//! suspended in the app stay suspended.
use super::{
    credentials::Credential, enrol, failed, staff::Spec, target::Target, target::UNCHANGED, Outcome,
};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Status {
    Created,
    Reactivated,
    /// Already active; the password is unchanged.
    Existing,
    /// Archived in the app; skipped, and its records stay with the Admin.
    Archived,
    /// Suspended by an Admin in the app (not by `clear-sample`); left suspended.
    Suspended,
}

pub struct Member {
    pub spec: &'static Spec,
    pub email: String,
    /// The account that holds its records, unless archived.
    pub holder: Option<Uuid>,
    pub status: Status,
}

#[derive(FromRow)]
struct Found {
    id: Uuid,
    active: bool,
    archived: bool,
    workspace_id: Option<String>,
    role: String,
    owner_id: Option<Uuid>,
    sample: bool,
    /// The member's latest team activity is a suspension by `clear-sample`.
    cleared: bool,
}

/// Creates or reactivates one sample member. Call under the workspace lock and
/// `team::access::lock_owner`. An email held by any account that is not this Admin's
/// sample staff refuses the seed.
pub async fn ensure(
    tx: &mut Tx<'_>,
    target: &Target,
    spec: &'static Spec,
    credential: &Credential,
) -> Outcome<Member> {
    let email = spec.email(&target.email);
    let found = sqlx::query_as::<_, Found>(
        "SELECT u.id,u.active,u.deleted_at IS NOT NULL AS archived,u.workspace_id,u.role, \
         u.owner_id,m.user_id IS NOT NULL AS sample,COALESCE((SELECT t.action='suspended' \
         AND t.source='sample' FROM crm_team_activity t WHERE t.member_id=u.id \
         ORDER BY t.created_at DESC,t.id DESC LIMIT 1),false) AS cleared FROM crm_users u \
         LEFT JOIN crm_sample_accounts m ON m.user_id=u.id WHERE u.email=$1 FOR UPDATE OF u",
    )
    .bind(&email)
    .fetch_optional(&mut **tx)
    .await
    .map_err(failed)?;
    let hash = &credential.hash;
    let (holder, status) = match found {
        None => (
            Some(enrol::create(tx, target, spec, &email, hash).await?),
            Status::Created,
        ),
        Some(found) if !owned(&found, target) => {
            return Err(format!(
                "{email} belongs to an account that is not sample staff of this team.{UNCHANGED}"
            ));
        }
        Some(found) if found.archived => (None, Status::Archived),
        Some(found) if found.active => (Some(found.id), Status::Existing),
        Some(found) if !found.cleared => (None, Status::Suspended),
        Some(found) => {
            enrol::reactivate(tx, target, spec, hash, found.id).await?;
            (Some(found.id), Status::Reactivated)
        }
    };
    Ok(Member {
        spec,
        email,
        holder,
        status,
    })
}

/// Marked as sample staff of exactly this Admin's team.
fn owned(found: &Found, target: &Target) -> bool {
    found.sample
        && found.role == "staff"
        && found.owner_id == Some(target.owner)
        && found.workspace_id.as_deref() == Some(target.workspace.as_str())
}
