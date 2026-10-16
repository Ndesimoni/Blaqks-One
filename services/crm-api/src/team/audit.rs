//! `crm_team_activity`: the append-only history of team changes. Rows name the member
//! and the action only; grant contents and credentials are never stored.
use crate::{
    activity::window::{Item, Person, Window},
    auth::profile::UserRow,
    error::ApiResult,
};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

pub async fn append(
    transaction: &mut Transaction<'_, Postgres>,
    actor: Uuid,
    workspace: &str,
    member: Uuid,
    action: &str,
) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO crm_team_activity (id,actor_id,workspace_id,member_id,action) \
         VALUES ($1,$2,$3,$4,$5)",
    )
    .bind(Uuid::new_v4())
    .bind(actor)
    .bind(workspace)
    .bind(member)
    .bind(action)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

#[derive(FromRow)]
struct Row {
    id: Uuid,
    action: String,
    actor_id: Uuid,
    actor_name: String,
    member_id: Uuid,
    member_name: String,
    sample: bool,
    micros: i64,
    at: String,
}

/// One page of team events for the activity feed, newest first. Only Admins and the
/// Super Admin (re-read live) see team events; anyone else gets an empty page.
pub async fn page(
    transaction: &mut Transaction<'_, Postgres>,
    window: &Window,
    viewer: &UserRow,
) -> ApiResult<Vec<Item>> {
    if !matches!(viewer.role.as_str(), "admin" | "super-admin") {
        return Ok(Vec::new());
    }
    let sql = format!(
        "SELECT t.id,t.action,t.actor_id,actor.name AS actor_name,t.member_id,\
         member.name AS member_name,t.source='sample' AS sample,{stamps} \
         FROM crm_team_activity t JOIN crm_all_user_profiles actor ON actor.id=t.actor_id \
         JOIN crm_all_user_profiles member ON member.id=t.member_id \
         WHERE {window} ORDER BY t.created_at DESC,t.id DESC LIMIT $7",
        stamps = Window::stamps("t"),
        window = Window::clause("t"),
    );
    let rows = window
        .bind(sqlx::query_as::<_, Row>(&sql))
        .fetch_all(&mut **transaction)
        .await?;
    Ok(rows
        .into_iter()
        .map(|row| Item {
            id: row.id,
            at: row.at,
            kind: "team",
            action: row.action,
            collection: None,
            actor: Person {
                id: row.actor_id,
                name: row.actor_name,
            },
            record: None,
            member: Some(Person {
                id: row.member_id,
                name: row.member_name,
            }),
            sample: row.sample,
            micros: row.micros,
        })
        .collect())
}
