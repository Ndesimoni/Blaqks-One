//! The sample Blaqks One team accounts (`people::SPECS`): created active in the organisation,
//! reactivated by a later seed after `clear-platform-sample` suspended them; accounts the
//! Owner suspended or archived in the app stay as they are.
use super::{
    super::{accounts::Status, credentials::Credential, failed, target::UNCHANGED, Outcome},
    enrol::{create, reactivate},
    people::Spec,
};
use crate::workspaces::ORGANISATION;
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

pub struct Member {
    pub spec: &'static Spec,
    pub email: String,
    /// The live account, unless archived or suspended in the app.
    pub id: Option<Uuid>,
    pub status: Status,
}

#[derive(FromRow)]
struct Found {
    id: Uuid,
    active: bool,
    archived: bool,
    sample: bool,
    /// The latest team event is a suspension by `clear-platform-sample`.
    cleared: bool,
}

pub async fn ensure(
    tx: &mut Tx<'_>,
    owner: Uuid,
    owner_email: &str,
    spec: &'static Spec,
    credential: &Credential,
) -> Outcome<Member> {
    let email = spec.email(owner_email);
    let found = sqlx::query_as::<_, Found>(
        "SELECT u.id,u.active,u.deleted_at IS NOT NULL AS archived,(m.user_id IS NOT NULL \
         AND u.role='platform' AND u.workspace_id=$2) AS sample,COALESCE((SELECT \
         t.action='suspended' AND t.source='sample' FROM crm_team_activity t \
         WHERE t.member_id=u.id ORDER BY t.created_at DESC,t.id DESC LIMIT 1),false) AS cleared \
         FROM crm_users u LEFT JOIN crm_sample_accounts m ON m.user_id=u.id \
         WHERE u.email=$1 FOR UPDATE OF u",
    )
    .bind(&email)
    .bind(ORGANISATION)
    .fetch_optional(&mut **tx)
    .await
    .map_err(failed)?;
    let (id, status) = match found {
        None => (
            Some(create(tx, owner, spec, &email, credential).await?),
            Status::Created,
        ),
        Some(found) if !found.sample => {
            return Err(format!(
                "{email} belongs to an account that is not Blaqks One sample staff.{UNCHANGED}"
            ));
        }
        Some(found) if found.archived => (None, Status::Archived),
        Some(found) if found.active => (Some(found.id), Status::Existing),
        Some(found) if !found.cleared => (None, Status::Suspended),
        Some(found) => {
            reactivate(tx, owner, spec, found.id, credential).await?;
            (Some(found.id), Status::Reactivated)
        }
    };
    Ok(Member {
        spec,
        email,
        id,
        status,
    })
}

/// Suspends the live sample team members and signs them out, as `clear-sample` does for a
/// company's sample staff; a later seed reactivates them.
pub async fn suspend(tx: &mut Tx<'_>, owner: Uuid) -> Outcome<usize> {
    let ids: Vec<Uuid> = sqlx::query_scalar(
        "UPDATE crm_users u SET active=false,version=u.version+1 FROM crm_sample_accounts m \
         WHERE m.user_id=u.id AND m.workspace_id=$1 AND u.role='platform' AND u.active \
         AND u.deleted_at IS NULL RETURNING u.id",
    )
    .bind(ORGANISATION)
    .fetch_all(&mut **tx)
    .await
    .map_err(failed)?;
    sqlx::query("DELETE FROM crm_sessions WHERE user_id=ANY($1)")
        .bind(&ids)
        .execute(&mut **tx)
        .await
        .map_err(failed)?;
    for id in &ids {
        crate::team::audit::append(tx, owner, ORGANISATION, *id, "suspended")
            .await
            .map_err(failed)?;
    }
    Ok(ids.len())
}
