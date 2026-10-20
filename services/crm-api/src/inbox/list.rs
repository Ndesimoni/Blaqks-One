//! `GET /inbox/conversations`: the viewer's conversations, most recent activity first,
//! with keyset pagination and optional `state`, `channel` and `assignee` (`me` or
//! `unassigned`) filters. Unknown parameters are refused.
use super::{
    access::{self, predicate, Viewer},
    view::{Row, COLUMNS},
};
use crate::{
    activity::cursor,
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{Path, RawQuery, State},
    Json,
};
use serde_json::{json, Value};
use std::collections::BTreeMap;

const KEYS: [&str; 5] = ["state", "channel", "assignee", "cursor", "limit"];
const STATES: [&str; 5] = ["new", "open", "waiting", "resolved", "spam"];
const CHANNELS: [&str; 5] = ["whatsapp", "email", "facebook", "instagram", "tiktok"];
pub const INVALID: &str = "Check the Inbox filters and try again.";

#[derive(Debug, Default, PartialEq)]
pub struct Filters {
    pub state: Option<String>,
    pub channel: Option<String>,
    pub assignee: Option<String>,
    pub cursor: Option<(i64, uuid::Uuid)>,
    pub limit: i64,
}

/// Strict parsing: one value per known key, known values only, limit 1–100 (default 50).
pub fn parse(raw: Option<&str>) -> ApiResult<Filters> {
    let mut values: BTreeMap<String, String> = BTreeMap::new();
    for (key, value) in url::form_urlencoded::parse(raw.unwrap_or("").as_bytes()) {
        let known = KEYS.contains(&key.as_ref());
        if !known
            || values
                .insert(key.into_owned(), value.into_owned())
                .is_some()
        {
            return Err(ApiError::invalid(INVALID));
        }
    }
    let pick = |key: &str, allowed: &[&str]| -> ApiResult<Option<String>> {
        match values.get(key) {
            None => Ok(None),
            Some(value) if allowed.contains(&value.as_str()) => Ok(Some(value.clone())),
            Some(_) => Err(ApiError::invalid(INVALID)),
        }
    };
    let limit = match values.get("limit") {
        None => 50,
        Some(value) => value
            .parse::<i64>()
            .map_err(|_| ApiError::invalid(INVALID))?,
    };
    if !(1..=100).contains(&limit) {
        return Err(ApiError::invalid(INVALID));
    }
    let cursor = match values.get("cursor") {
        Some(value) => Some(cursor::decode(value).ok_or(ApiError::invalid(INVALID))?),
        None => None,
    };
    Ok(Filters {
        state: pick("state", &STATES)?,
        channel: pick("channel", &CHANNELS)?,
        assignee: pick("assignee", &["me", "unassigned"])?,
        cursor,
        limit,
    })
}

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
    RawQuery(raw): RawQuery,
) -> ApiResult<Json<Value>> {
    access::ensure_member(&state, &session, &workspace).await?;
    let filters = parse(raw.as_deref())?;
    let mut tx = state.pool.begin().await?;
    let viewer = Viewer::of(&access::live(&mut tx, &workspace, session.user.id).await?);
    let sql = format!(
        "SELECT {COLUMNS} FROM inbox.crm_inbox_conversations c \
         WHERE c.workspace_id=$1 AND {visible} \
           AND ($6::bigint IS NULL OR (c.last_activity_at,c.id) < \
             (timestamptz 'epoch'+$6::bigint*interval '1 microsecond',$7::uuid)) \
           AND ($8::text IS NULL OR c.state=$8) AND ($9::text IS NULL OR c.channel=$9) \
           AND ($10::text IS NULL OR ($10='me' AND c.assignee_id=$5) \
             OR ($10='unassigned' AND c.assignee_id IS NULL)) \
         ORDER BY c.last_activity_at DESC,c.id DESC LIMIT $11",
        visible = predicate("c", "$2", "$3", "$4"),
    );
    let rows: Vec<Row> = sqlx::query_as(&sql)
        .bind(&workspace)
        .bind(viewer.caller)
        .bind(viewer.whatsapp)
        .bind(viewer.email)
        .bind(viewer.id)
        .bind(filters.cursor.map(|(micros, _)| micros))
        .bind(filters.cursor.map(|(_, id)| id))
        .bind(&filters.state)
        .bind(&filters.channel)
        .bind(&filters.assignee)
        .bind(filters.limit + 1)
        .fetch_all(&mut *tx)
        .await?;
    tx.commit().await?;
    let limit = usize::try_from(filters.limit).unwrap_or(50);
    let next = (rows.len() > limit).then(|| cursor::encode(rows[limit - 1].key()));
    let conversations: Vec<Value> = rows.iter().take(limit).map(Row::view).collect();
    Ok(Json(
        json!({"conversations": conversations, "nextCursor": next}),
    ))
}

#[cfg(test)]
#[path = "list_tests.rs"]
mod tests;
