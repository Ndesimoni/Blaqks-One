//! SQL for `integrations.crm_sendgrid_addresses` (migration 0045). Addresses belong to the
//! company's domain, not to one connection row, so a reserved address stays reserved after
//! a reconnect (security review L2). Every query is bound to the workspace.
use crate::error::{ApiError, ApiResult};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const TAKEN: &str = "This address is already used or kept for a former member. Choose another.";
pub const HAS_ADDRESS: &str = "This member already has a sending address.";

type Tx<'a, 'b> = &'a mut Transaction<'b, Postgres>;

const SELECT: &str = "SELECT id,domain,local_part,member_id,display_name,state,version,
    to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at,
    to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS updated_at
    FROM integrations.crm_sendgrid_addresses";

#[derive(sqlx::FromRow)]
pub struct AddressRow {
    pub id: Uuid,
    pub domain: String,
    pub local_part: String,
    pub member_id: Uuid,
    pub display_name: String,
    pub state: String,
    pub version: i64,
    pub created_at: String,
    pub updated_at: String,
}

impl AddressRow {
    pub fn view(&self) -> Value {
        json!({
            "id": self.id,
            "memberId": self.member_id,
            "localPart": self.local_part,
            "address": format!("{}@{}", self.local_part, self.domain),
            "displayName": self.display_name,
            "state": self.state,
            "version": self.version,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        })
    }
}

/// The domain of the company's live SendGrid connection.
pub async fn live_domain(tx: Tx<'_, '_>, workspace: &str) -> ApiResult<Option<String>> {
    sqlx::query_scalar(
        "SELECT external_account_id FROM integrations.crm_channel_connections
         WHERE workspace_id=$1 AND provider='sendgrid' AND state<>'disconnected'",
    )
    .bind(workspace)
    .fetch_optional(&mut **tx)
    .await
    .map_err(Into::into)
}

pub async fn list(tx: Tx<'_, '_>, workspace: &str, domain: &str) -> ApiResult<Vec<AddressRow>> {
    sqlx::query_as(&format!(
        "{SELECT} WHERE workspace_id=$1 AND domain=$2 ORDER BY state,local_part"
    ))
    .bind(workspace)
    .bind(domain)
    .fetch_all(&mut **tx)
    .await
    .map_err(Into::into)
}

pub async fn by_id(tx: Tx<'_, '_>, workspace: &str, id: Uuid) -> ApiResult<Option<AddressRow>> {
    sqlx::query_as(&format!(
        "{SELECT} WHERE workspace_id=$1 AND id=$2 FOR UPDATE"
    ))
    .bind(workspace)
    .bind(id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(Into::into)
}

pub async fn by_local(
    tx: Tx<'_, '_>,
    workspace: &str,
    domain: &str,
    local: &str,
) -> ApiResult<Option<AddressRow>> {
    sqlx::query_as(&format!(
        "{SELECT} WHERE workspace_id=$1 AND domain=$2 AND local_part=$3 FOR UPDATE"
    ))
    .bind(workspace)
    .bind(domain)
    .bind(local)
    .fetch_optional(&mut **tx)
    .await
    .map_err(Into::into)
}

pub struct NewAddress<'a> {
    pub workspace: &'a str,
    pub domain: &'a str,
    pub local: &'a str,
    pub member: Uuid,
    pub name: &'a str,
    pub actor: Uuid,
}

pub async fn insert(tx: Tx<'_, '_>, new: &NewAddress<'_>) -> ApiResult<Uuid> {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO integrations.crm_sendgrid_addresses
         (id,workspace_id,domain,local_part,member_id,display_name,state,version,
          created_by,updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,'active',1,$7,$7)",
    )
    .bind(id)
    .bind(new.workspace)
    .bind(new.domain)
    .bind(new.local)
    .bind(new.member)
    .bind(new.name)
    .bind(new.actor)
    .execute(&mut **tx)
    .await
    .map_err(write_error)?;
    Ok(id)
}

pub fn write_error(error: sqlx::Error) -> ApiError {
    let constraint = error
        .as_database_error()
        .filter(|database| database.code().as_deref() == Some("23505"))
        .and_then(|database| database.constraint().map(str::to_owned));
    match constraint.as_deref() {
        Some("crm_sendgrid_addresses_member") => ApiError::conflict(HAS_ADDRESS),
        Some(_) => ApiError::conflict(TAKEN),
        None => error.into(),
    }
}
