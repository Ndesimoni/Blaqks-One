use super::{
    collections::COLLECTIONS,
    deal_links,
    mutation::Entry,
    projections,
    visibility::{predicate, RecordScope},
};
use crate::{
    auth::session::Session,
    error::ApiResult,
    state::AppState,
    workspaces::{ensure_access, member},
};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};
use sqlx::FromRow;
use uuid::Uuid;

/// A visible row with the link columns the projections need; only `entry` is returned.
#[derive(FromRow)]
pub struct Row {
    #[sqlx(flatten)]
    pub entry: Entry,
    pub collection: String,
    pub legacy_id: String,
    pub contact_id: Option<String>,
    pub client_ref: Option<String>,
    pub property_ref: Option<String>,
    pub referral_ref: Option<String>,
    pub deal_ref: Option<String>,
}

/// `GET records` (contract §3, L3): one REPEATABLE READ READ ONLY transaction reads the
/// live profile, the scope, the visible records in granted collections and then the
/// read-only projections (including `dealLinks`), so they all describe the same snapshot.
pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    ensure_access(&state, &session, &workspace).await?;
    let mut transaction = state.pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *transaction)
        .await?;
    let user = member(&mut transaction, &workspace, session.user.id).await?;
    let scope = RecordScope::of(&user);
    let granted: Vec<&str> = COLLECTIONS
        .iter()
        .map(|collection| collection.name)
        .filter(|name| user.can_collection(name))
        .collect();
    let sql = format!(
        "SELECT r.id,r.version,r.payload,r.assignee_id,r.collection,r.legacy_id,r.contact_id,\
         r.client_ref,r.property_ref,r.referral_ref,r.deal_ref FROM crm_records r \
         WHERE r.workspace_id=$1 AND r.collection=ANY($2) AND {} ORDER BY r.created_at,r.id",
        predicate("r", "$1", "$3")
    );
    let rows = sqlx::query_as::<_, Row>(&sql)
        .bind(&workspace)
        .bind(&granted)
        .bind(scope.caller())
        .fetch_all(&mut *transaction)
        .await?;
    let mut projected = projections::build(&mut transaction, &workspace, &user, &rows).await?;
    projected["dealLinks"] =
        deal_links::projection(&mut transaction, &workspace, &user, &rows).await?;
    transaction.commit().await?;
    let mut records = json!({});
    for collection in COLLECTIONS {
        let entries: Vec<&Entry> = rows
            .iter()
            .filter(|row| row.collection == collection.name)
            .map(|row| &row.entry)
            .collect();
        records[collection.name] = json!(entries);
    }
    let mut body = projected;
    body["scope"] = json!(if scope.is_team() { "team" } else { "assigned" });
    body["records"] = records;
    Ok(Json(body))
}

/// Legacy IDs of visible rows in one collection.
pub fn visible_ids<'a>(rows: &'a [Row], collection: &str) -> Vec<&'a str> {
    rows.iter()
        .filter(|row| row.collection == collection)
        .map(|row| row.legacy_id.as_str())
        .collect()
}

pub fn row_ids(rows: &[Row]) -> Vec<Uuid> {
    rows.iter().map(|row| row.entry.id).collect()
}
