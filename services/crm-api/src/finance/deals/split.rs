//! `PUT /finance/deals/{id}/split` (Admin, finance-design §6.2, §13 M-F4): the second
//! agent, their share and an override of the holder's share, with a reason. Earned
//! deals change their split only by revision.
use super::{
    gate::{self, Need, STALE},
    links, list, row,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    finance::{
        errors::INELIGIBLE,
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
use uuid::Uuid;

pub const INVALID: &str = "Provide valid split details.";
pub const REVISE: &str = "Revise the deal to change its split.";
pub const PAIR: &str = "Choose a second agent and their share together.";
const KEYS: [&str; 5] = [
    "version",
    "secondAgentId",
    "secondAgentShareBp",
    "overrideAgentShareBp",
    "reason",
];

/// `(secondAgentId, secondAgentShareBp)`: both null or both set.
pub fn second(id: &Value, share: &Value) -> ApiResult<Option<(Uuid, i32)>> {
    match (id, share) {
        (Value::Null, Value::Null) => Ok(None),
        (Value::Null, _) | (_, Value::Null) => Err(ApiError::invalid(PAIR)),
        (id, share) => Ok(Some((wire::uuid(id, INELIGIBLE)?, wire::bp(share)?))),
    }
}

pub fn nullable_bp(value: &Value) -> ApiResult<Option<i32>> {
    match value {
        Value::Null => Ok(None),
        value => wire::bp(value).map(Some),
    }
}

pub async fn split(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    gate::writer(&state, &session, &headers, &workspace, Need::Manage).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(INVALID))?;
    let body = wire::exact(body, &KEYS, INVALID)?;
    let version = gate::version(&body["version"])?;
    let wanted = second(&body["secondAgentId"], &body["secondAgentShareBp"])?;
    let override_bp = nullable_bp(&body["overrideAgentShareBp"])?;
    let reason = gate::optional_reason(&body["reason"])?;
    let id = gate::id(&id)?;
    let mut tx = state.pool.begin().await?;
    let live = gate::relock(&mut tx, &workspace, session.user.id, Need::Manage).await?;
    let deal = row::locked(&mut tx, &workspace, &live, id).await?;
    if deal.version != version {
        return Err(ApiError::stale(STALE));
    }
    if deal.earned() {
        return Err(ApiError::conflict(REVISE));
    }
    let current = deal.second_agent_id.zip(deal.second_agent_share_bp);
    if current == wanted && deal.override_agent_share_bp == override_bp {
        let entry = list::entry(&mut tx, &workspace, &live, id).await?;
        return Ok(Json(json!({ "deal": entry })));
    }
    let reason = reason.ok_or(ApiError::invalid(gate::REASON))?;
    if let Some((agent, _)) = wanted.filter(|(agent, _)| Some(*agent) != deal.second_agent_id) {
        let eligible = links::finance_member(&mut tx, &workspace, agent, true).await?;
        if !eligible || Some(agent) == deal.assignee_id {
            return Err(ApiError::invalid(INELIGIBLE));
        }
    }
    let kind = match wanted {
        Some(pair) if Some(pair) == current => deal.second_agent_kind.clone(),
        Some(_) => Some("split".into()),
        None => None,
    };
    let override_reason = match override_bp {
        Some(bp) if Some(bp) == deal.override_agent_share_bp => deal.override_reason.clone(),
        Some(_) => Some(reason.clone()),
        None => None,
    };
    sqlx::query(
        "UPDATE crm_deals SET second_agent_id=$2,second_agent_share_bp=$3,second_agent_kind=$4, \
         override_agent_share_bp=$5,override_reason=$6,version=version+1,updated_at=now() \
         WHERE id=$1",
    )
    .bind(deal.id)
    .bind(wanted.map(|(agent, _)| agent))
    .bind(wanted.map(|(_, share)| share))
    .bind(&kind)
    .bind(override_bp)
    .bind(&override_reason)
    .execute(&mut *tx)
    .await?;
    let text = |id: Option<Uuid>| id.map(|id| id.to_string());
    let changes = Changes::default()
        .pair(
            "secondAgentId",
            text(deal.second_agent_id),
            text(wanted.map(|w| w.0)),
        )
        .pair(
            "secondAgentShareBp",
            deal.second_agent_share_bp,
            wanted.map(|w| w.1),
        )
        .pair(
            "overrideAgentShareBp",
            deal.override_agent_share_bp,
            override_bp,
        );
    let (ws, actor) = (workspace.as_str(), live.id);
    let action = Action::SplitChanged;
    events::append(
        &mut tx,
        ws,
        Entity::Deal,
        deal.id,
        action,
        actor,
        changes,
        Some(&reason),
    )
    .await?;
    audit::append(&mut tx, actor, ws, "updated", "Deals", deal.id).await?;
    let entry = list::entry(&mut tx, &workspace, &live, id).await?;
    tx.commit().await?;
    Ok(Json(json!({ "deal": entry })))
}
