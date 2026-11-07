//! `GET /api/crm/platform/clients?stage=&q=&owner=&limit=&cursor=`: the live clients, the
//! most recently updated first, with the number at each stage for the same search and
//! owner (so the stage tabs keep their counts while one is open). Archived clients never
//! appear. The cursor is the last row's update time and ID.
use super::{guard, model, rules, view};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{rejection::QueryRejection, Query, State},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Map, Value};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use uuid::Uuid;

const INVALID: &str = "Use stage, q, owner (me, all or unassigned), limit (1-100) and cursor.";

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ListQuery {
    stage: Option<String>,
    q: Option<String>,
    owner: Option<String>,
    limit: Option<i64>,
    cursor: Option<String>,
}

/// The search and owner filter both queries share: $1 text, $2 owner mode, $3 the caller.
const FILTER: &str = "c.archived_at IS NULL AND ($1::text IS NULL OR strpos(lower(concat_ws( \
    chr(10),c.company_name,c.contact_name,c.email,c.phone)),lower($1))>0) \
    AND (CASE $2::text WHEN 'me' THEN c.owner_id IS NOT DISTINCT FROM $3 \
    WHEN 'unassigned' THEN c.owner_id IS NULL ELSE true END)";

fn cursor(raw: Option<&str>) -> ApiResult<(Option<String>, Option<Uuid>)> {
    let Some(raw) = raw.filter(|raw| !raw.is_empty()) else {
        return Ok((None, None));
    };
    let invalid = || ApiError::invalid(INVALID);
    let (at, id) = raw.split_once('|').ok_or_else(invalid)?;
    OffsetDateTime::parse(at, &Rfc3339).map_err(|_| invalid())?;
    let id = Uuid::parse_str(id).map_err(|_| invalid())?;
    Ok((Some(at.to_string()), Some(id)))
}

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    query: Result<Query<ListQuery>, QueryRejection>,
) -> ApiResult<Json<Value>> {
    let (mut tx, live) = guard::read(&state, &session).await?;
    let Query(query) = query.map_err(|_| ApiError::invalid(INVALID))?;
    let stage = match query.stage.as_deref() {
        None | Some("all") | Some("") => None,
        Some(key) => Some(model::stage(key).ok_or(ApiError::invalid(model::STAGE))?),
    };
    let text = rules::text(query.q, 100, INVALID)?;
    let owner = match query.owner.as_deref() {
        None | Some("all") | Some("") => "all",
        Some("me") => "me",
        Some("unassigned") => "unassigned",
        Some(_) => return Err(ApiError::invalid(INVALID)),
    };
    let limit = query.limit.unwrap_or(50);
    if !(1..=100).contains(&limit) {
        return Err(ApiError::invalid(INVALID));
    }
    let (after_at, after_id) = cursor(query.cursor.as_deref())?;
    let mut rows = sqlx::query_as::<_, view::Row>(&format!(
        "{} WHERE {FILTER} AND ($4::text IS NULL OR c.stage=$4) \
         AND ($5::timestamptz IS NULL OR (c.updated_at,c.id)<($5::timestamptz,$6::uuid)) \
         ORDER BY c.updated_at DESC,c.id DESC LIMIT $7",
        view::SELECT
    ))
    .bind(&text)
    .bind(owner)
    .bind(live.id)
    .bind(stage)
    .bind(after_at)
    .bind(after_id)
    .bind(limit + 1)
    .fetch_all(&mut *tx)
    .await?;
    let more = rows.len() as i64 > limit;
    rows.truncate(limit as usize);
    let counted: Vec<(String, i64)> = sqlx::query_as(&format!(
        "SELECT c.stage,count(*) FROM platform_clients.crm_platform_clients c \
         WHERE {FILTER} GROUP BY c.stage"
    ))
    .bind(&text)
    .bind(owner)
    .bind(live.id)
    .fetch_all(&mut *tx)
    .await?;
    let companies = view::companies(&mut tx, &rows).await?;
    tx.commit().await?;
    let mut counts = Map::new();
    for (key, _) in model::STAGES {
        let count = counted
            .iter()
            .find(|(stage, _)| stage == key)
            .map_or(0, |c| c.1);
        counts.insert(key.into(), json!(count));
    }
    let next = more
        .then(|| {
            rows.last()
                .map(|row| format!("{}|{}", row.cursor_at, row.id))
        })
        .flatten();
    let clients: Vec<Value> = rows
        .iter()
        .map(|row| view::summary(row, &companies))
        .collect();
    Ok(Json(json!({
        "clients": clients,
        "stageCounts": counts,
        "nextCursor": next,
    })))
}
