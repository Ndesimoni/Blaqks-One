//! The ledger is visible under the same participant/company Admin rules as the agreement.
use super::{access, payment_store, store};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};

pub async fn read(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, id)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    access::ensure_reader(&state, &session, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    // Entries, effective terms and totals must describe the same committed ledger.
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *tx)
        .await?;
    let row = store::load(&mut tx, access::id(&id)?)
        .await?
        .filter(|row| access::can_read(row, &session, &workspace))
        .ok_or(ApiError::missing())?;
    let payments = payment_store::entries(&mut tx, row.id).await?;
    let summary = payment_store::summary(&mut tx, &row).await?;
    tx.commit().await?;
    Ok(Json(json!({"payments":payments,"summary":summary})))
}
