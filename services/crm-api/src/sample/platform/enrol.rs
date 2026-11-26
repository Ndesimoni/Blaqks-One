//! Writes the sample Blaqks One team accounts: a new active `platform` member of the
//! organisation with its position's access, or a cleared sample member restored with a new
//! password. Team events go to the organisation's team feed with source `sample`.
use super::{
    super::{credentials::Credential, failed, Outcome},
    people::Spec,
};
use crate::{team::audit, workspaces::ORGANISATION};
use sqlx::{types::Json, Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

pub async fn create(
    tx: &mut Tx<'_>,
    owner: Uuid,
    spec: &Spec,
    email: &str,
    credential: &Credential,
) -> Outcome<Uuid> {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO crm_users (id,name,email,phone,password_hash,role,active,owner_id, \
         workspace_id,accepted_at) VALUES ($1,$2,$3,$4,$5,'platform',true,$6,$7,now())",
    )
    .bind(id)
    .bind(spec.name())
    .bind(email)
    .bind(spec.phone)
    .bind(&credential.hash)
    .bind(owner)
    .bind(ORGANISATION)
    .execute(&mut **tx)
    .await
    .map_err(failed)?;
    sqlx::query("INSERT INTO crm_sample_accounts (user_id,workspace_id) VALUES ($1,$2)")
        .bind(id)
        .bind(ORGANISATION)
        .execute(&mut **tx)
        .await
        .map_err(failed)?;
    sqlx::query("INSERT INTO crm_platform_access (user_id,preset,access) VALUES ($1,$2,$3)")
        .bind(id)
        .bind(spec.preset.key())
        .bind(Json(spec.access()))
        .execute(&mut **tx)
        .await
        .map_err(failed)?;
    for action in ["invited", "activated"] {
        audit::append(tx, owner, ORGANISATION, id, action)
            .await
            .map_err(failed)?;
    }
    Ok(id)
}

pub async fn reactivate(
    tx: &mut Tx<'_>,
    owner: Uuid,
    spec: &Spec,
    id: Uuid,
    credential: &Credential,
) -> Outcome<()> {
    sqlx::query(
        "UPDATE crm_users SET name=$2,phone=$3,password_hash=$4,active=true,version=version+1 \
         WHERE id=$1 AND role='platform' AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(spec.name())
    .bind(spec.phone)
    .bind(&credential.hash)
    .execute(&mut **tx)
    .await
    .map_err(failed)?;
    sqlx::query(
        "UPDATE crm_platform_access SET preset=$2,access=$3,version=version+1 WHERE user_id=$1",
    )
    .bind(id)
    .bind(spec.preset.key())
    .bind(Json(spec.access()))
    .execute(&mut **tx)
    .await
    .map_err(failed)?;
    audit::append(tx, owner, ORGANISATION, id, "activated")
        .await
        .map_err(failed)?;
    Ok(())
}
