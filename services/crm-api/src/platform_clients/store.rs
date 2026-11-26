//! Writing clients. Every change bumps the version and the update time, and an edit or
//! archive first locks the live row at the version the caller reviewed.
use super::input::Fields;
use crate::error::{ApiError, ApiResult};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const STALE: &str = "This client changed since you opened it. Reload and try again.";

/// Saves a new client; `created_by` is empty for the website intake.
pub(super) async fn insert(
    tx: &mut Transaction<'_, Postgres>,
    fields: &Fields,
    created_by: Option<Uuid>,
) -> ApiResult<Uuid> {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO platform_clients.crm_platform_clients (id,company_name,contact_name, \
         phone,email,source,stage,notes,next_follow_up,owner_id,created_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10,$11)",
    )
    .bind(id)
    .bind(&fields.company_name)
    .bind(&fields.contact_name)
    .bind(&fields.phone)
    .bind(&fields.email)
    .bind(&fields.source)
    .bind(&fields.stage)
    .bind(&fields.notes)
    .bind(&fields.next_follow_up)
    .bind(fields.owner_id)
    .bind(created_by)
    .execute(&mut **tx)
    .await?;
    Ok(id)
}

/// The live client's fields, locked, when `version` is current: 404 for an unknown or
/// archived client, 409 for an older version.
pub(super) async fn locked(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    version: i64,
) -> ApiResult<Fields> {
    #[derive(sqlx::FromRow)]
    struct Current {
        version: i64,
        #[sqlx(flatten)]
        fields: Fields,
    }
    let current = sqlx::query_as::<_, Current>(
        "SELECT version,company_name,contact_name,phone,email,source,stage,notes, \
         to_char(next_follow_up,'YYYY-MM-DD') AS next_follow_up,owner_id \
         FROM platform_clients.crm_platform_clients \
         WHERE id=$1 AND archived_at IS NULL FOR UPDATE",
    )
    .bind(id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(ApiError::missing)?;
    if current.version != version {
        return Err(ApiError::stale(STALE));
    }
    Ok(current.fields)
}

/// Saves the edited fields.
pub(super) async fn update(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    fields: &Fields,
) -> ApiResult<()> {
    sqlx::query(
        "UPDATE platform_clients.crm_platform_clients SET company_name=$2,contact_name=$3, \
         phone=$4,email=$5,source=$6,stage=$7,notes=$8,next_follow_up=$9::date,owner_id=$10, \
         version=version+1,updated_at=now() WHERE id=$1",
    )
    .bind(id)
    .bind(&fields.company_name)
    .bind(&fields.contact_name)
    .bind(&fields.phone)
    .bind(&fields.email)
    .bind(&fields.source)
    .bind(&fields.stage)
    .bind(&fields.notes)
    .bind(&fields.next_follow_up)
    .bind(fields.owner_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Moves the client up the list after something was logged; the fields and version stay.
pub(super) async fn touch(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> ApiResult<()> {
    sqlx::query("UPDATE platform_clients.crm_platform_clients SET updated_at=now() WHERE id=$1")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

/// Archives the client: it leaves every list and read; nothing is removed.
pub(super) async fn archive(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> ApiResult<()> {
    sqlx::query(
        "UPDATE platform_clients.crm_platform_clients \
         SET archived_at=now(),version=version+1,updated_at=now() WHERE id=$1",
    )
    .bind(id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Locks a live client for a timeline entry: 404 for an unknown or archived client.
pub(super) async fn hold(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> ApiResult<()> {
    sqlx::query_scalar::<_, i32>(
        "SELECT 1 FROM platform_clients.crm_platform_clients \
         WHERE id=$1 AND archived_at IS NULL FOR UPDATE",
    )
    .bind(id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(ApiError::missing)?;
    Ok(())
}
