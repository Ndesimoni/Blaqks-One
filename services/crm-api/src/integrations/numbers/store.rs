//! SQL for `integrations.crm_whatsapp_numbers` (migration 0087). Every read is bound to the
//! workspace except `taken`, which answers only which phones are active somewhere, never
//! where, so "already connected" names no other company (design §4).
use crate::error::{ApiError, ApiResult};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const TAKEN: &str = "This number is already connected.";
pub const HAS_NUMBER: &str = "This member already has a WhatsApp number. Disconnect it first.";

type Tx<'a, 'b> = &'a mut Transaction<'b, Postgres>;

const SELECT: &str = "SELECT id,member_id,phone_e164,state,version,
    to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at
    FROM integrations.crm_whatsapp_numbers";

#[derive(sqlx::FromRow)]
pub struct NumberRow {
    pub id: Uuid,
    pub member_id: Uuid,
    pub phone_e164: String,
    pub state: String,
    pub version: i64,
    pub created_at: String,
}

impl NumberRow {
    /// The only shape the browser sees; the sender SID and connection stay inside.
    pub fn view(&self) -> Value {
        json!({
            "id": self.id,
            "memberId": self.member_id,
            "phone": self.phone_e164,
            "state": self.state,
            "version": self.version,
            "createdAt": self.created_at,
        })
    }
}

/// Active numbers in the company, or only `member`'s when given.
pub async fn active(
    tx: Tx<'_, '_>,
    workspace: &str,
    member: Option<Uuid>,
) -> ApiResult<Vec<NumberRow>> {
    sqlx::query_as(&format!(
        "{SELECT} WHERE workspace_id=$1 AND state='active' AND ($2::uuid IS NULL OR member_id=$2) \
         ORDER BY created_at,id"
    ))
    .bind(workspace)
    .bind(member)
    .fetch_all(&mut **tx)
    .await
    .map_err(Into::into)
}

/// Locked for a change in the caller's transaction.
pub async fn by_id(tx: Tx<'_, '_>, workspace: &str, id: Uuid) -> ApiResult<Option<NumberRow>> {
    sqlx::query_as(&format!(
        "{SELECT} WHERE workspace_id=$1 AND id=$2 FOR UPDATE"
    ))
    .bind(workspace)
    .bind(id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(Into::into)
}

/// Which of `phones` are active in any company.
pub async fn taken(tx: Tx<'_, '_>, phones: &[String]) -> ApiResult<Vec<String>> {
    sqlx::query_scalar(
        "SELECT phone_e164 FROM integrations.crm_whatsapp_numbers
         WHERE phone_e164=ANY($1) AND state='active'",
    )
    .bind(phones)
    .fetch_all(&mut **tx)
    .await
    .map_err(Into::into)
}

pub struct NewNumber<'a> {
    pub workspace: &'a str,
    pub connection: Uuid,
    pub member: Uuid,
    pub phone: &'a str,
    pub sender_sid: Option<&'a str>,
    pub actor: Uuid,
}

pub async fn insert(tx: Tx<'_, '_>, new: &NewNumber<'_>) -> ApiResult<Uuid> {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO integrations.crm_whatsapp_numbers
         (id,workspace_id,connection_id,member_id,phone_e164,sender_sid,state,version,
          created_by,updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,'active',1,$7,$7)",
    )
    .bind(id)
    .bind(new.workspace)
    .bind(new.connection)
    .bind(new.member)
    .bind(new.phone)
    .bind(new.sender_sid)
    .bind(new.actor)
    .execute(&mut **tx)
    .await
    .map_err(write_error)?;
    Ok(id)
}

fn write_error(error: sqlx::Error) -> ApiError {
    let constraint = error
        .as_database_error()
        .filter(|database| database.code().as_deref() == Some("23505"))
        .and_then(|database| database.constraint().map(str::to_owned));
    match constraint.as_deref() {
        Some("crm_whatsapp_numbers_member") => ApiError::conflict(HAS_NUMBER),
        Some("crm_whatsapp_numbers_phone") => ApiError::conflict(TAKEN),
        _ => error.into(),
    }
}
