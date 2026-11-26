//! One Blaqks One team member as the Owner's team page shows them: name, email, phone,
//! position, `{area: level}` access, status, last active and the version its controls send
//! back. Never the password, sessions or devices.
use super::target::Tx;
use crate::{
    auth::sessions,
    error::ApiResult,
    workspaces::{platform::areas, ORGANISATION},
};
use serde::Serialize;
use sqlx::{types::Json, FromRow};
use std::collections::BTreeMap;
use uuid::Uuid;

#[derive(FromRow)]
struct Row {
    id: Uuid,
    name: String,
    email: String,
    phone: String,
    preset: String,
    access: Json<serde_json::Value>,
    active: bool,
    accepted: bool,
    revoked: bool,
    archived: bool,
    version: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamMember {
    id: Uuid,
    name: String,
    email: String,
    phone: String,
    preset: String,
    access: BTreeMap<&'static str, &'static str>,
    status: &'static str,
    last_active_at: Option<String>,
    version: i64,
}

fn status(row: &Row) -> &'static str {
    if row.archived {
        "archived"
    } else if !row.accepted && !row.revoked {
        "pending"
    } else if row.active {
        "active"
    } else {
        "suspended"
    }
}

/// The organisation's platform members (or the one named), current ones first, by name.
pub async fn rows(tx: &mut Tx, only: Option<Uuid>) -> ApiResult<Vec<TeamMember>> {
    let rows: Vec<Row> = sqlx::query_as(
        "SELECT m.id,m.name,m.email,m.phone,a.preset,a.access,m.active,m.accepted,m.revoked, \
         m.archived,m.version FROM crm_member_profiles m \
         JOIN crm_platform_access a ON a.user_id=m.id \
         WHERE m.role='platform' AND m.workspace_id=$1 AND ($2::uuid IS NULL OR m.id=$2) \
         ORDER BY m.archived,m.name,m.id",
    )
    .bind(ORGANISATION)
    .bind(only)
    .fetch_all(&mut **tx)
    .await?;
    let ids: Vec<Uuid> = rows.iter().map(|row| row.id).collect();
    let seen = sessions::last_seen(tx, &ids).await?;
    Ok(rows
        .into_iter()
        .map(|row| TeamMember {
            status: status(&row),
            last_active_at: seen
                .iter()
                .find(|(id, _)| *id == row.id)
                .map(|(_, at)| at.clone()),
            id: row.id,
            name: row.name,
            email: row.email,
            phone: row.phone,
            preset: row.preset,
            access: areas::to_map(&areas::stored(&row.access.0)),
            version: row.version,
        })
        .collect())
}

/// The one member, for a route's response.
pub async fn one(tx: &mut Tx, id: Uuid) -> ApiResult<TeamMember> {
    rows(tx, Some(id))
        .await?
        .into_iter()
        .next()
        .ok_or_else(crate::error::ApiError::forbidden)
}
