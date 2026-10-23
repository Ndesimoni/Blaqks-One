//! `POST /agreements/{id}/payments {expectedVersion, amountFils, paidOn}` and
//! `/payments/{payment}/confirm|withdraw {expectedVersion}` (docs/agreements-a3b.md): the
//! named payer records or withdraws, the named payee confirms; the rules are in
//! `payment_write.rs`.
use super::{access, command, payment_write::record};
use crate::{auth::session::Session, error::ApiResult, state::AppState};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::Value;

pub async fn paid(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    let cmd = command::begin(
        &state,
        &session,
        &headers,
        &workspace,
        &id,
        body,
        &["expectedVersion", "amountFils", "paidOn"],
    )
    .await?;
    record(cmd, "paid", None).await
}
pub async fn confirm(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id, payment)): Path<(String, String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    let cmd = command::begin(
        &state,
        &session,
        &headers,
        &workspace,
        &id,
        body,
        &["expectedVersion"],
    )
    .await?;
    record(cmd, "confirmed", Some(access::id(&payment)?)).await
}
pub async fn withdraw(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id, payment)): Path<(String, String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    let cmd = command::begin(
        &state,
        &session,
        &headers,
        &workspace,
        &id,
        body,
        &["expectedVersion"],
    )
    .await?;
    record(cmd, "withdrawn", Some(access::id(&payment)?)).await
}
