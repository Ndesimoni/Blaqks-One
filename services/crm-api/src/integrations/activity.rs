//! Channel events for the workspace activity feed (packet X1a, design §13 O4). Items name
//! the channel, action, actor and time only: never the account ID, label or credential.
use super::model::Channel;
use crate::{
    activity::window::{Item, Person, Window},
    auth::profile::UserRow,
    error::ApiResult,
};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

/// Every action `crm_integration_events` records (migration 0031).
pub const ACTIONS: [&str; 4] = [
    "connected",
    "reconnected",
    "reconnect_required",
    "disconnected",
];

#[derive(FromRow)]
struct Row {
    id: Uuid,
    action: String,
    actor_id: Uuid,
    actor_name: String,
    channel: String,
    micros: i64,
    at: String,
}

/// Only the company's own Admin manages channels, so only they see channel events
/// (design §11). Staff and the Super Admin get an empty page.
pub fn visible(viewer: &UserRow, workspace: &str) -> bool {
    viewer.role == "admin" && viewer.workspace_id == workspace
}

/// One page of channel events, newest first, bound by the shared window.
pub async fn page(
    transaction: &mut Transaction<'_, Postgres>,
    window: &Window,
    viewer: &UserRow,
) -> ApiResult<Vec<Item>> {
    if !visible(viewer, &window.workspace) {
        return Ok(Vec::new());
    }
    let sql = format!(
        "SELECT e.id,e.action,e.actor_id,actor.name AS actor_name,c.channel,{stamps} \
         FROM integrations.crm_integration_events e \
         JOIN integrations.crm_channel_connections c ON c.id=e.connection_id \
         JOIN crm_all_user_profiles actor ON actor.id=e.actor_id \
         WHERE {window} ORDER BY e.created_at DESC,e.id DESC LIMIT $7",
        stamps = Window::stamps("e"),
        window = Window::clause("e"),
    );
    let rows = window
        .bind(sqlx::query_as::<_, Row>(&sql))
        .fetch_all(&mut **transaction)
        .await?;
    Ok(rows.into_iter().filter_map(item).collect())
}

/// Stored channel text never passes through; an unknown value drops the row.
fn item(row: Row) -> Option<Item> {
    let channel = Channel::parse(&row.channel)?.as_str();
    Some(Item {
        id: row.id,
        at: row.at,
        kind: "channel",
        action: row.action,
        collection: None,
        actor: Person {
            id: row.actor_id,
            name: row.actor_name,
        },
        record: None,
        member: None,
        channel: Some(channel),
        sample: false,
        micros: row.micros,
    })
}
