//! Generic, participant-only selection/reopening notices. No private listing or client fields.
use super::gate;
use crate::{auth::session::Session, error::ApiResult, state::AppState};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn append(
    tx: &mut Transaction<'_, Postgres>,
    request: Uuid,
    selected: Option<Uuid>,
    kind: &str,
    version: i64,
) -> ApiResult<()> {
    let recipients:Vec<Uuid> = sqlx::query_scalar("SELECT member_id FROM marketplace.crm_market_answers WHERE request_id=$1 UNION SELECT broker_id FROM marketplace.crm_market_conversations WHERE request_id=$1")
        .bind(request).fetch_all(&mut **tx).await?;
    for member in recipients {
        if selected == Some(member) {
            continue;
        }
        sqlx::query("INSERT INTO marketplace.crm_market_notices(id,request_id,member_id,kind,request_version) VALUES($1,$2,$3,$4,$5) ON CONFLICT(request_id,member_id,kind,request_version) DO NOTHING")
            .bind(Uuid::new_v4()).bind(request).bind(member).bind(kind).bind(version).execute(&mut **tx).await?;
    }
    Ok(())
}

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    gate::reader(&state, &session, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    gate::live_member(&mut tx, &workspace, session.user.id).await?;
    gate::company_open(&mut tx, &workspace).await?;
    gate::joined(&mut tx, session.user.id).await?;
    let rows:Vec<(Uuid,Uuid,String,String)>=sqlx::query_as("SELECT id,request_id,kind,created_at::text FROM marketplace.crm_market_notices WHERE member_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100")
        .bind(session.user.id).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(
        json!({"notifications":rows.into_iter().map(|(id,request,kind,at)|json!({"id":id,"requestId":request,"kind":kind,"createdAt":at})).collect::<Vec<_>>()}),
    ))
}
