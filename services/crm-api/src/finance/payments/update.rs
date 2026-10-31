//! `PATCH /finance/payments/{id} {payment, version, reason?}` (finance-design §4, §13 M-F4,
//! M-F6): pending rows stay pending, rejected rows are resubmitted, approved rows change
//! only on the Admin path with a reason and stay within the deal's net. The deal is fixed.
use super::{
    input::{self, INVALID},
    row,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    finance::{
        access, approval_rules,
        deals::gate::{self, Need},
        entry::{Kind, STALE},
        entry_edit::{self, Edit},
        entry_view, entry_wire,
        events::Changes,
    },
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};

pub async fn update(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    gate::writer(&state, &session, &headers, &workspace, Need::Edit).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(INVALID))?;
    let (payment, version, reason) = entry_edit::envelope(body, Kind::Payment, INVALID)?;
    let input = input::parse(&payment, false)?;
    let id = gate::id(&id)?;
    let mut tx = state.pool.begin().await?;
    let today = access::today(&mut tx).await?;
    let live = gate::relock(&mut tx, &workspace, session.user.id, Need::Edit).await?;
    let stored = row::locked(&mut tx, &workspace, &live, id).await?;
    if stored.state.version != version {
        return Err(ApiError::stale(STALE));
    }
    input::ensure_same_deal(&input, &stored.deal_ref)?;
    let edit = entry_edit::mode(&mut tx, &stored.state, &live, reason.as_deref()).await?;
    if input.receipt_date != stored.receipt_date {
        entry_wire::not_future(&input.receipt_date, &today)?;
    }
    let funds = approval_rules::funds(&mut tx, &workspace, &stored.deal_ref, Some(id)).await?;
    if edit == Edit::Approved {
        funds.ensure_room(input.amount_fils)?;
    }
    let vat = funds.vat(input.amount_fils, stored.vat_fils > 0)?;
    let changes = Changes::default()
        .pair(
            "receiptDate",
            stored.receipt_date.clone(),
            input.receipt_date.clone(),
        )
        .pair("amountFils", stored.state.amount_fils, input.amount_fils)
        .pair("vatFils", stored.vat_fils, vat)
        .text("reference", stored.reference != input.reference)
        .text("notes", stored.state.notes != input.notes);
    if changes.is_empty() && edit != Edit::Resubmit {
        let entry = entry_view::entry(&mut tx, &workspace, &live, Kind::Payment, id).await?;
        tx.commit().await?;
        return Ok(Json(json!({ "payment": entry })));
    }
    sqlx::query(&format!(
        "UPDATE crm_payments SET receipt_date=$2::date,amount_fils=$3,vat_fils=$4,reference=$5, \
         notes=$6,last_edited_by=$7,version=version+1,updated_at=now(){} WHERE id=$1",
        edit.status_sql()
    ))
    .bind(id)
    .bind(&input.receipt_date)
    .bind(input.amount_fils)
    .bind(vat)
    .bind(&input.reference)
    .bind(&input.notes)
    .bind(live.id)
    .execute(&mut *tx)
    .await?;
    let (ws, kind, state) = (workspace.as_str(), Kind::Payment, &stored.state);
    let reason = reason.as_deref();
    entry_edit::record(&mut tx, ws, kind, state, edit, &live, changes, reason).await?;
    let entry = entry_view::entry(&mut tx, ws, &live, kind, id).await?;
    tx.commit().await?;
    Ok(Json(json!({ "payment": entry })))
}
