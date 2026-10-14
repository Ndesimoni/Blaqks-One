use super::{directory, update_store};
use crate::team::access;
use crate::{
    auth::{
        actions_request::ActionsRequest,
        permissions::{ChannelAccess, Permissions},
        protection,
        session::Session,
    },
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateRequest {
    pub version: i64,
    pub name: Option<String>,
    pub phone: Option<String>,
    pub positions: Option<Vec<String>>,
    pub permissions: Option<Permissions>,
    pub channel_access: Option<ChannelAccess>,
    pub active: Option<bool>,
    pub record_scope: Option<RecordScopeGrant>,
    /// Complete staff action grants; absent keeps or presets them (M-D). The `finance`
    /// key may be omitted and is then carried over the same way.
    pub actions: Option<ActionsRequest>,
}

/// The staff-only full-team grant (M7); positions and invitations never set it.
#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RecordScopeGrant {
    Assigned,
    Team,
}

impl RecordScopeGrant {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Assigned => "assigned",
            Self::Team => "team",
        }
    }
}

pub async fn update(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<UpdateRequest>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    let owner = access::owner(&state, &session, &workspace).await?;
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let Json(request) =
        body.map_err(|_| ApiError::invalid("Provide valid team member changes."))?;
    let id = Uuid::parse_str(&id).map_err(|_| ApiError::invalid("Invalid member ID."))?;
    update_store::update(
        &state.pool,
        session.user.id,
        owner,
        &workspace,
        id,
        access::can_manage_admin(&session, &workspace),
        request,
    )
    .await?;
    Ok(Json(
        json!({"member":directory::find(&state.pool, id).await?}),
    ))
}
