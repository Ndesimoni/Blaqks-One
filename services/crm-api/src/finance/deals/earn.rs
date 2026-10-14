//! `POST /finance/deals/{id}/earn {version, earnedOn}` (finance-design §2.4, §13 M-F2,
//! H-F1): approvers snapshot the split. Staff approvers never earn deals they hold,
//! share or reassigned since the last earn/unearn, and only within the last 31 days.
use super::{
    compute, earn_rules,
    gate::{self, Need, STALE},
    list, row, snapshot,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    finance::{
        access,
        events::{self, Action, Changes, Entity},
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

const INVALID: &str = "Provide a version and an earned date.";

pub async fn earn(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    gate::writer(&state, &session, &headers, &workspace, Need::Approve).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(INVALID))?;
    let body = wire::exact(body, &["version", "earnedOn"], INVALID)?;
    let version = gate::version(&body["version"])?;
    let earned_on = wire::date(&body["earnedOn"])?;
    let id = gate::id(&id)?;
    let mut tx = state.pool.begin().await?;
    let today = access::today(&mut tx).await?;
    earn_rules::ensure_not_future(&earned_on, &today)?;
    let live = gate::relock(&mut tx, &workspace, session.user.id, Need::Approve).await?;
    let deal = row::locked(&mut tx, &workspace, &live, id).await?;
    if deal.version != version {
        return Err(ApiError::stale(STALE));
    }
    earn_rules::ensure_earnable(&mut tx, &live, &deal, &earned_on, &today).await?;
    earn_rules::ensure_second_agent(&mut tx, &workspace, &deal).await?;
    let basis = compute::current_basis(&mut tx, &workspace, &deal, &earned_on).await?;
    let outcome = compute::compute(&deal, basis)?;
    let actor = live.id;
    let revision = snapshot::insert(
        &mut tx, &workspace, &deal, &earned_on, &outcome, actor, None,
    )
    .await?;
    sqlx::query(
        "UPDATE crm_deals SET earned_on=$2::date,stage='Completed',version=version+1, \
         updated_at=now() WHERE id=$1",
    )
    .bind(deal.id)
    .bind(&earned_on)
    .execute(&mut *tx)
    .await?;
    let warnings = earn_rules::warnings(&mut tx, &workspace, &deal).await?;
    let agreement = outcome.basis.agreement.map(|(id, _)| id.to_string());
    let changes = Changes::default()
        .pair("earnedOn", Value::Null, earned_on.clone())
        .pair("stage", deal.stage.clone(), "Completed")
        .pair("revision", Value::Null, revision)
        .pair("agreementId", Value::Null, agreement)
        .pair(
            "splitSource",
            Value::Null,
            super::names::source_name(outcome.source),
        )
        .pair("netFils", Value::Null, outcome.calculation.net_fils);
    let ws = workspace.as_str();
    events::append(
        &mut tx,
        ws,
        Entity::Deal,
        deal.id,
        Action::Earned,
        actor,
        changes,
        None,
    )
    .await?;
    audit::append(&mut tx, actor, ws, "earned", "Deals", deal.id).await?;
    let entry = list::entry(&mut tx, &workspace, &live, id).await?;
    tx.commit().await?;
    Ok(Json(json!({ "deal": entry, "warnings": warnings })))
}
