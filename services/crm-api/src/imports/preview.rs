use super::{member, model::PreviewRequest, planning, snapshot};
use crate::{
    auth::{
        protection,
        session::{self, Session},
    },
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces::{self, ORGANISATION},
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};

/// The owning Admin previews an import into their own company (BO1a item 10). Any source,
/// the organisation's browser set included (owner answer Q3), lands in this workspace; a
/// personal source names the member who receives its parent records.
pub async fn preview(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<PreviewRequest>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    member::ensure_importer(&state, &session, &workspace).await?;
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let Json(request) =
        body.map_err(|_| ApiError::invalid("Provide a source workspace and record arrays."))?;
    let source = request.source_workspace_id.trim();
    if source.is_empty() || source.len() > 256 {
        return Err(ApiError::invalid(
            "A source workspace identifier is required.",
        ));
    }
    if source != ORGANISATION && request.member_id.is_none() {
        return Err(ApiError::invalid(member::CHOOSE));
    }
    let normalized = request.records.normalize()?;
    let mut transaction = state.pool.begin().await?;
    workspaces::lock(&mut transaction, &workspace).await?;
    member::relock(&mut transaction, &workspace, session.user.id).await?;
    let target = snapshot::read(&mut transaction, &workspace).await?;
    let fingerprint = snapshot::fingerprint(&target);
    let plan = planning::plan(normalized, &target)?;
    if let Some(id) = request.member_id {
        member::holder(&mut transaction, &workspace, id, &plan.records).await?;
    }
    let token = session::random_token();
    let records = serde_json::to_value(plan.records)
        .map_err(|_| ApiError::invalid("Invalid import records."))?;
    sqlx::query("DELETE FROM crm_import_plans WHERE expires_at<=now()")
        .execute(&mut *transaction)
        .await?;
    let expires_at: String = sqlx::query_scalar(
        "INSERT INTO crm_import_plans \
         (token_hash,actor_id,workspace_id,records,fingerprint,counts,skipped,member_id) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING \
         to_char(expires_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')",
    )
    .bind(session::digest(&token))
    .bind(session.user.id)
    .bind(&workspace)
    .bind(records)
    .bind(fingerprint)
    .bind(json!(plan.counts))
    .bind(json!(plan.skipped))
    .bind(request.member_id)
    .fetch_one(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(Json(
        json!({"token":token,"counts":plan.counts,"skipped":plan.skipped,"expiresAt":expires_at}),
    ))
}
