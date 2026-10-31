//! `POST /finance/payments {payment}` (finance-design §4, §6.2): finance Add; the deal must
//! be visible under the finance predicate (identical `link_missing` otherwise) and earned.
//! The payment starts pending with a server-issued `PM-` ID and server-computed VAT.
use super::input::{self, PaymentInput, INVALID};
use crate::{
    auth::{profile::UserRow, session::Session},
    error::{ApiError, ApiResult},
    finance::{
        access, approval_rules,
        deals::{
            gate::{self, Need},
            visible::{self, DEAL_MISSING},
        },
        entry::Kind,
        entry_view, entry_wire,
        events::{self, Action, Changes, Entity},
        ids::{self, FinanceIds},
        wire,
    },
    records::audit,
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn create(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    gate::writer(&state, &session, &headers, &workspace, Need::Create).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(INVALID))?;
    let body = wire::exact(body, &["payment"], INVALID)?;
    let payment = input::parse(&body["payment"], true)?;
    let mut tx = state.pool.begin().await?;
    entry_wire::not_future(&payment.receipt_date, &access::today(&mut tx).await?)?;
    let live = gate::relock(&mut tx, &workspace, session.user.id, Need::Create).await?;
    let legacy = ids::issue(&mut tx, &workspace, FinanceIds::Payments).await?;
    let id = insert(&mut tx, &workspace, &live, &payment, &legacy).await?;
    let ws = workspace.as_str();
    let entry = entry_view::entry(&mut tx, ws, &live, Kind::Payment, id).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "payment": entry }))))
}

/// Steps 5–10 under the workspace lock with the live submitter: the visible earned deal,
/// server VAT, the pending row, a `submitted` event and activity. `legacy` is the issued
/// ID (the local sample-data command passes its own `-S` IDs).
pub async fn insert(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    live: &UserRow,
    payment: &PaymentInput,
    legacy: &str,
) -> ApiResult<Uuid> {
    let deal_ref = payment.deal_ref.as_deref().unwrap_or_default();
    if !visible::exists(tx, workspace, deal_ref, gate::caller(live)).await? {
        return Err(ApiError::link_missing(DEAL_MISSING));
    }
    let funds = approval_rules::funds(tx, workspace, deal_ref, None).await?;
    if funds.net_fils.is_none() {
        return Err(ApiError::conflict(approval_rules::NOT_EARNED));
    }
    let vat = funds.vat(payment.amount_fils, false)?;
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO crm_payments (id,workspace_id,legacy_id,deal_ref,receipt_date,amount_fils, \
         vat_fils,reference,notes,submitted_by,last_edited_by) \
         VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8,$9,$10,$10)",
    )
    .bind(id)
    .bind(workspace)
    .bind(legacy)
    .bind(deal_ref)
    .bind(&payment.receipt_date)
    .bind(payment.amount_fils)
    .bind(vat)
    .bind(&payment.reference)
    .bind(&payment.notes)
    .bind(live.id)
    .execute(&mut **tx)
    .await?;
    let changes = Changes::default()
        .pair("paymentId", Value::Null, legacy)
        .pair("dealId", Value::Null, deal_ref)
        .pair("receiptDate", Value::Null, payment.receipt_date.clone())
        .pair("amountFils", Value::Null, payment.amount_fils)
        .pair("vatFils", Value::Null, vat)
        .pair("status", Value::Null, "pending")
        .text("reference", payment.reference.is_some())
        .text("notes", payment.notes.is_some());
    let (ws, actor) = (workspace, live.id);
    let submitted = Action::Submitted;
    events::append(tx, ws, Entity::Payment, id, submitted, actor, changes, None).await?;
    audit::append(tx, actor, ws, "created", "Payments", id).await?;
    Ok(id)
}
