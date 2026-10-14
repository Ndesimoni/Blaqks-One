//! Writes sample staff rows: a new active member of the target Admin's team, or a
//! suspended sample member restored to its definition with a new password. Role,
//! owner and workspace are never changed by a reactivation.
use super::{failed, staff::Spec, target::Target, target::UNCHANGED, Outcome};
use crate::team::audit;
use sqlx::{types::Json, Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

pub async fn create(
    tx: &mut Tx<'_>,
    target: &Target,
    spec: &Spec,
    email: &str,
    hash: &str,
) -> Outcome<Uuid> {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO crm_users (id,name,email,phone,password_hash,role,active,owner_id, \
         workspace_id,positions,permissions,channel_access,record_scope,actions,accepted_at) \
         VALUES ($1,$2,$3,$4,$5,'staff',true,$6,$7,$8,$9,$10,$11,$12,now())",
    )
    .bind(id)
    .bind(spec.name())
    .bind(email)
    .bind(spec.phone)
    .bind(hash)
    .bind(target.owner)
    .bind(&target.workspace)
    .bind(Json(spec.positions()))
    .bind(Json(spec.permissions()))
    .bind(Json(spec.channels.clone()))
    .bind(spec.record_scope())
    .bind(Json(spec.actions()))
    .execute(&mut **tx)
    .await
    .map_err(failed)?;
    sqlx::query("INSERT INTO crm_sample_accounts (user_id,workspace_id) VALUES ($1,$2)")
        .bind(id)
        .bind(&target.workspace)
        .execute(&mut **tx)
        .await
        .map_err(failed)?;
    for action in ["invited", "activated"] {
        audit::append(tx, target.owner, &target.workspace, id, action)
            .await
            .map_err(failed)?;
    }
    Ok(id)
}

/// Only an unarchived staff row of this Admin's team in this workspace is updated.
pub async fn reactivate(
    tx: &mut Tx<'_>,
    target: &Target,
    spec: &Spec,
    hash: &str,
    id: Uuid,
) -> Outcome<()> {
    let updated = sqlx::query(
        "UPDATE crm_users SET name=$2,phone=$3,password_hash=$4,active=true,positions=$5, \
         permissions=$6,channel_access=$7,record_scope=$8,actions=$9,version=version+1 \
         WHERE id=$1 AND role='staff' AND owner_id=$10 AND workspace_id=$11 \
         AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(spec.name())
    .bind(spec.phone)
    .bind(hash)
    .bind(Json(spec.positions()))
    .bind(Json(spec.permissions()))
    .bind(Json(spec.channels.clone()))
    .bind(spec.record_scope())
    .bind(Json(spec.actions()))
    .bind(target.owner)
    .bind(&target.workspace)
    .execute(&mut **tx)
    .await
    .map_err(failed)?;
    if updated.rows_affected() != 1 {
        return Err(format!(
            "A sample staff account is no longer in this team.{UNCHANGED}"
        ));
    }
    audit::append(tx, target.owner, &target.workspace, id, "updated")
        .await
        .map_err(failed)
}
