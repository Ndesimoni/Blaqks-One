//! Per-agent commission agreements (finance-design §3.6, §6.2, §13 M-F3, L-F8).
//! Admins read and write; team-view staff and the Super Admin read; the own view sees
//! only its own agreements, through `GET /finance`.
use super::{access, agreements_delete, agreements_store, wire};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{
        rejection::{JsonRejection, QueryRejection},
        Path, Query, State,
    },
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::FromRow;
use uuid::Uuid;

const INVALID: &str = "Provide valid agreement details.";

#[derive(FromRow)]
pub struct AgreementRow {
    pub id: Uuid,
    pub agent_id: Uuid,
    pub agent_name: String,
    pub agent_share_bp: i32,
    pub effective_from: String,
    pub effective_to: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Agent {
    id: Uuid,
    name: String,
}

impl AgreementRow {
    /// Team view, with the agent.
    pub fn view(self) -> Value {
        let agent = Agent {
            id: self.agent_id,
            name: self.agent_name,
        };
        json!({"id": self.id, "agent": agent, "agentShareBp": self.agent_share_bp,
            "effectiveFrom": self.effective_from, "effectiveTo": self.effective_to})
    }

    /// Own view (`myAgreements`): the caller's own terms only.
    pub fn own_view(self) -> Value {
        json!({"id": self.id, "agentShareBp": self.agent_share_bp,
            "effectiveFrom": self.effective_from, "effectiveTo": self.effective_to})
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ListQuery {
    agent_id: Option<String>,
}

/// `GET /finance/agreements?agentId=`: team finance only.
pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
    query: Result<Query<ListQuery>, QueryRejection>,
) -> ApiResult<Json<Value>> {
    access::team_reader(&state, &session, &workspace).await?;
    let Query(query) = query.map_err(|_| ApiError::invalid(INVALID))?;
    let agent = match query.agent_id {
        Some(id) => Some(wire::uuid(&Value::String(id), super::errors::NOT_STAFF)?),
        None => None,
    };
    let rows = agreements_store::list(&state.pool, &workspace, agent).await?;
    let agreements: Vec<Value> = rows.into_iter().map(AgreementRow::view).collect();
    Ok(Json(json!({"agreements": agreements})))
}

/// A validated `POST /finance/agreements` body.
pub struct NewAgreement {
    pub agent_id: Uuid,
    pub agent_share_bp: i32,
    pub effective_from: String,
}

/// `POST /finance/agreements`: Admin only; auto-closes the agent's open agreement.
pub async fn create(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    access::manager(&state, &session, &headers, &workspace).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(INVALID))?;
    let body = wire::exact(body, &["agentId", "agentShareBp", "effectiveFrom"], INVALID)?;
    let input = NewAgreement {
        agent_id: wire::uuid(&body["agentId"], super::errors::NOT_STAFF)?,
        agent_share_bp: wire::bp(&body["agentShareBp"])?,
        effective_from: wire::date(&body["effectiveFrom"])?,
    };
    let (created, closed) =
        agreements_store::create(&state.pool, session.user.id, &workspace, input).await?;
    let closed = closed.map(|(id, to)| json!({"id": id, "effectiveTo": to}));
    let body = json!({"agreement": created.view(), "closed": closed});
    Ok((StatusCode::CREATED, Json(body)))
}

/// `DELETE /finance/agreements/{id}`: Admin only, future agreements only; reopens the
/// agreement it auto-closed. Unknown and malformed IDs give the same 404.
pub async fn delete(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    access::manager(&state, &session, &headers, &workspace).await?;
    let id = Uuid::parse_str(&id).map_err(|_| ApiError::missing())?;
    let reopened = agreements_delete::delete(&state.pool, session.user.id, &workspace, id).await?;
    let reopened = reopened.map(|(id, to)| json!({"id": id, "effectiveTo": to}));
    Ok(Json(json!({"deleted": id, "reopened": reopened})))
}
