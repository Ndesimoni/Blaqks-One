//! Target writes: versioned sets and clears under the workspace lock, with redacted
//! activity (the target row only, never its value) in the same transaction.
use super::{
    access,
    errors::STALE,
    input::TargetInput,
    rows::{current, TargetRow, COLUMNS},
};
use crate::{
    error::{ApiError, ApiResult},
    records::audit,
};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

async fn insert(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    input: &TargetInput,
    value: i64,
    actor: Uuid,
) -> ApiResult<TargetRow> {
    let sql = format!(
        "INSERT INTO crm_targets (id,workspace_id,member_id,month,metric,value,updated_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING {COLUMNS}"
    );
    Ok(sqlx::query_as::<_, TargetRow>(&sql)
        .bind(Uuid::new_v4())
        .bind(workspace)
        .bind(input.member)
        .bind(&input.month)
        .bind(input.metric.key())
        .bind(value)
        .bind(actor)
        .fetch_one(&mut **tx)
        .await?)
}

async fn update(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    value: i64,
    actor: Uuid,
) -> ApiResult<TargetRow> {
    let sql = format!(
        "UPDATE crm_targets SET value=$2,updated_by=$3,updated_at=now(),version=version+1 \
         WHERE id=$1 RETURNING {COLUMNS}"
    );
    Ok(sqlx::query_as::<_, TargetRow>(&sql)
        .bind(id)
        .bind(value)
        .bind(actor)
        .fetch_one(&mut **tx)
        .await?)
}

/// Sets (`value`) or clears (`None`) one target. An unchanged value keeps its version and
/// writes no activity; clearing a target that does not exist is a no-op.
pub async fn save(
    pool: &PgPool,
    actor: Uuid,
    workspace: &str,
    input: TargetInput,
) -> ApiResult<Option<TargetRow>> {
    let mut tx = pool.begin().await?;
    access::lock_manager(&mut tx, workspace, actor).await?;
    if let Some(member) = input.member {
        access::ensure_member(&mut tx, workspace, member).await?;
    }
    let existing = current(&mut tx, workspace, &input).await?;
    match (&existing, input.version) {
        (None, None) => {}
        (Some(row), Some(version)) if row.version == version => {}
        _ => return Err(ApiError::stale(STALE)),
    }
    let (action, id, saved) = match (existing, input.value) {
        (None, None) => return Ok(None),
        (Some(row), Some(value)) if row.value == value => return Ok(Some(row)),
        (None, Some(value)) => {
            let row = insert(&mut tx, workspace, &input, value, actor).await?;
            ("created", row.id, Some(row))
        }
        (Some(row), Some(value)) => {
            let row = update(&mut tx, row.id, value, actor).await?;
            ("updated", row.id, Some(row))
        }
        (Some(row), None) => {
            sqlx::query("DELETE FROM crm_targets WHERE id=$1")
                .bind(row.id)
                .execute(&mut *tx)
                .await?;
            ("deleted", row.id, None)
        }
    };
    audit::append(&mut tx, actor, workspace, action, "Targets", id).await?;
    tx.commit().await?;
    Ok(saved)
}
