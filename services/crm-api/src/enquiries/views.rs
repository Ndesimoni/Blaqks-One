use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

#[derive(Deserialize)]
pub struct Page {
    pub page: Option<i64>,
}

#[derive(sqlx::FromRow)]
struct Row {
    id: Uuid,
    source_site: Uuid,
    publication_id: Option<Uuid>,
    assignee_id: Option<Uuid>,
    lead_id: Uuid,
    payload: Value,
    created_at: String,
}

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
    Query(page): Query<Page>,
) -> ApiResult<Json<Value>> {
    let mut tx = state.pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *tx)
        .await?;
    let user = workspaces::member(&mut tx, &workspace, session.user.id).await?;
    if user.role != "admin" || user.workspace_id != workspace || !user.can_collection("Clients") {
        return Err(ApiError::forbidden());
    }
    let count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM enquiries.crm_website_enquiries WHERE workspace_id=$1",
    )
    .bind(&workspace)
    .fetch_one(&mut *tx)
    .await?;
    let requested = page.page.unwrap_or(1).max(1);
    let current = requested.min(((count + 49) / 50).max(1));
    let rows: Vec<Row> = sqlx::query_as(
        "SELECT id,source_site,publication_id,assignee_id,lead_id,payload,created_at::text \
         FROM enquiries.crm_website_enquiries WHERE workspace_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET $2")
        .bind(&workspace).bind((current-1)*50).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    let rows: Vec<Value> = rows.into_iter().map(|row|
        json!({"id":row.id,"siteId":row.source_site,"listingId":row.publication_id,"assigneeId":row.assignee_id,"leadId":row.lead_id,"enquiry":row.payload,"createdAt":row.created_at})).collect();
    Ok(Json(
        json!({"data":rows,"pagination":{"total":count,"page":current,"pageSize":50}}),
    ))
}
