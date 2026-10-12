use super::{
    eligibility::{apply, eligible},
    requests::{self, BulkRequest, MAX_BULK_RECORDS},
};
use crate::{
    auth::{protection, session::Session},
    error::{ApiError, ApiResult},
    records::{
        history::Change,
        mutation::{Entry, ENTRY_COLUMNS},
        visibility::RecordScope,
    },
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};
use std::collections::{BTreeSet, HashMap};
use uuid::Uuid;

/// `POST /workspaces/{ws}/assignments/bulk` (L4, M7): team scope only, all-or-nothing.
/// A note is stored once per changed record, each on that record's own history row.
pub async fn bulk(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<BulkRequest>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    workspaces::ensure_access(&state, &session, &workspace).await?;
    protection::mutation(&state, &headers, &session.csrf_token)?;
    if !RecordScope::of(&session.user).is_team() {
        return Err(ApiError::forbidden());
    }
    let Json(body) = body.map_err(|_| ApiError::invalid("Provide up to 500 records to move."))?;
    let collections: BTreeSet<&str> = body.records.iter().map(|r| r.collection.as_str()).collect();
    if collections
        .iter()
        .any(|name| !session.user.can_collection(name))
    {
        return Err(ApiError::forbidden());
    }
    collections
        .iter()
        .try_for_each(|name| requests::ensure_assignable(name))?;
    let ids: Vec<Uuid> = body.records.iter().map(|record| record.id).collect();
    let distinct: BTreeSet<Uuid> = ids.iter().copied().collect();
    if ids.is_empty() || ids.len() > MAX_BULK_RECORDS || distinct.len() != ids.len() {
        return Err(ApiError::invalid("Choose 1 to 500 different records."));
    }
    body.records
        .iter()
        .try_for_each(|record| requests::ensure_version(record.version))?;
    let to = requests::target(body.to_id)?;
    let note = requests::note(body.note)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let actor = session.user.id;
    let user = workspaces::ensure_writable(&mut tx, &workspace, actor, None).await?;
    if !RecordScope::of(&user).is_team() || collections.iter().any(|c| !user.can_collection(c)) {
        return Err(ApiError::forbidden());
    }
    let rows: Vec<(Uuid, String, i64, Option<Uuid>)> = sqlx::query_as(
        "SELECT id,collection,version,assignee_id FROM crm_records \
         WHERE workspace_id=$1 AND id=ANY($2) ORDER BY id FOR UPDATE",
    )
    .bind(&workspace)
    .bind(&ids)
    .fetch_all(&mut *tx)
    .await?;
    let found: HashMap<Uuid, (String, i64, Option<Uuid>)> = rows
        .into_iter()
        .map(|(id, collection, version, assignee)| (id, (collection, version, assignee)))
        .collect();
    // Every listed row must exist in this workspace and collection before versions count.
    let rows: Vec<&(String, i64, Option<Uuid>)> = body
        .records
        .iter()
        .map(|record| {
            found
                .get(&record.id)
                .filter(|row| row.0 == record.collection)
        })
        .collect::<Option<_>>()
        .ok_or_else(ApiError::missing)?;
    if rows
        .iter()
        .zip(&body.records)
        .any(|(row, record)| row.1 != record.version)
    {
        return Err(ApiError::stale(
            "A record changed. Reload before moving records.",
        ));
    }
    let current: Vec<Option<Uuid>> = rows.iter().map(|row| row.2).collect();
    if let Some(member) = to {
        for collection in &collections {
            eligible(&mut tx, &workspace, collection, member).await?;
        }
    }
    for (record, from) in body.records.iter().zip(current) {
        if from == to {
            continue;
        }
        let change = Change {
            workspace: &workspace,
            record: record.id,
            collection: &record.collection,
            from,
            to,
            actor,
            reason: "bulk",
        };
        apply(&mut tx, &change, note.as_deref()).await?;
    }
    let sql = format!("SELECT {ENTRY_COLUMNS} FROM crm_records WHERE id=ANY($1)");
    let saved: Vec<Entry> = sqlx::query_as(&sql).bind(&ids).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    let mut by_id: HashMap<Uuid, Entry> = saved.into_iter().map(|e| (e.id, e)).collect();
    let entries: Vec<Entry> = ids.iter().filter_map(|id| by_id.remove(id)).collect();
    Ok(Json(json!({ "entries": entries })))
}
