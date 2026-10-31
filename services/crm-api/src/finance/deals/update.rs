//! `PATCH /finance/deals/{id} {deal, version}` (finance-design §6.2, §13 M-F1, M-F4).
//! Split fields are refused; earned money terms change only on the Admin path.
use super::{
    gate::{self, Need, STALE},
    handover_evidence::PENDING_FROZEN,
    input::{self, INVALID},
    links, list,
    row::{self, LOST},
    terms::{money_changed, stored, terms},
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    finance::{
        admin,
        errors::{DEAL_ID_FIXED, EARNED_LOCKED},
        events::{self, Action, Entity},
        wire,
    },
    records::audit,
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};

pub const UNEARN_FIRST: &str = "Unearn this deal before marking it lost or cancelled.";

pub async fn update(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    gate::writer(&state, &session, &headers, &workspace, Need::Edit).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(INVALID))?;
    let body = wire::exact(body, &["deal", "version"], INVALID)?;
    let version = gate::version(&body["version"])?;
    let mut input = input::parse(&body["deal"], false)?;
    let id = gate::id(&id)?;
    let mut tx = state.pool.begin().await?;
    let live = gate::relock(&mut tx, &workspace, session.user.id, Need::Edit).await?;
    let deal = row::locked(&mut tx, &workspace, &live, id).await?;
    if deal.version != version {
        return Err(ApiError::stale(STALE));
    }
    if input
        .deal_id
        .take()
        .is_some_and(|echoed| echoed != deal.legacy_id)
    {
        return Err(ApiError::invalid(DEAL_ID_FIXED));
    }
    let before = stored(&deal);
    let money = money_changed(&before, &input);
    let subject =
        (&input.client_ref, &input.property_ref) != (&before.client_ref, &before.property_ref);
    if deal.pending_agreement.is_some() && (money || subject) {
        return Err(ApiError::conflict(PENDING_FROZEN));
    }
    if deal.earned() && money && !live.finance_access().manage {
        return Err(ApiError::denied(EARNED_LOCKED));
    }
    if deal.earned() && LOST.contains(&input.stage) && input.stage != before.stage {
        return Err(ApiError::conflict(UNEARN_FIRST));
    }
    let client = Some(before.client_ref.as_str());
    links::ensure_client(&mut tx, &workspace, &live, &input.client_ref, client).await?;
    let property = input.property_ref.as_deref();
    let previous = before.property_ref.as_deref();
    links::ensure_property(&mut tx, &workspace, &live, property, previous).await?;
    let changes = terms(Some(&before), &input);
    if !changes.is_empty() {
        if deal.earned() && money {
            admin::admin_path(&mut tx, &live).await?;
        }
        sqlx::query(
            "UPDATE crm_deals SET client_ref=$2,property_ref=$3,deal_type=$4,stage=$5, \
             agreed_value_fils=$6,fee_basis=$7,fee_rate_bp=$8,fixed_fee_fils=$9, \
             partner_share_bp=$10,partner_name=$11,details=$12,version=version+1, \
             updated_at=now() WHERE id=$1",
        )
        .bind(deal.id)
        .bind(&input.client_ref)
        .bind(&input.property_ref)
        .bind(input.deal_type)
        .bind(input.stage)
        .bind(input.agreed_value_fils)
        .bind(input.fee_basis)
        .bind(input.fee_rate_bp)
        .bind(input.fixed_fee_fils)
        .bind(input.partner_share_bp)
        .bind(&input.partner_name)
        .bind(sqlx::types::Json(&input.details))
        .execute(&mut *tx)
        .await?;
        let actor = live.id;
        let (ws, deal_id) = (workspace.as_str(), deal.id);
        events::append(
            &mut tx,
            ws,
            Entity::Deal,
            deal_id,
            Action::Updated,
            actor,
            changes,
            None,
        )
        .await?;
        audit::append(&mut tx, actor, ws, "updated", "Deals", deal_id).await?;
    }
    let entry = list::entry(&mut tx, &workspace, &live, id).await?;
    tx.commit().await?;
    Ok(Json(json!({ "deal": entry })))
}
