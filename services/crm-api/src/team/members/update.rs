use super::{
    directory::{self, MemberRow},
    update_store,
};
use crate::team::access;
use crate::{
    auth::{
        actions::Actions,
        actions_request::ActionsRequest,
        permissions::{ChannelAccess, Permissions},
        protection,
        session::Session,
    },
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces::platform::Area,
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

/// Whether the change only cancels a pending invitation: `active` false and nothing else.
pub fn cancels(current: &MemberRow, request: &UpdateRequest) -> bool {
    let only_active = request.name.is_none()
        && request.phone.is_none()
        && request.positions.is_none()
        && request.permissions.is_none()
        && request.channel_access.is_none()
        && request.record_scope.is_none()
        && request.actions.is_none();
    !current.accepted && request.active == Some(false) && only_active
}

/// Whether a stored grant changes: modules, actions, record scope or channels.
pub fn grants_changed(current: &MemberRow, request: &UpdateRequest) -> bool {
    let user = &current.user;
    let channels = request.channel_access.as_ref() != Some(&user.channel_access.0);
    if user.role != "staff" {
        return channels;
    }
    let scope = request
        .record_scope
        .is_some_and(|scope| scope.as_str() != user.record_scope);
    let actions = request.actions.is_some_and(|requested| {
        !user.actions_recorded() || requested.actions != Actions::from_stored(&user.actions.0)
    });
    channels || scope || actions || request.permissions.as_ref() != Some(&user.permissions.0)
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
        // Blaqks One staff reach this route only for the organisation's Admins.
        Area::InviteAdmins,
        request,
    )
    .await?;
    crate::integrations::revoke_soon(&state);
    Ok(Json(
        json!({"member":directory::find(&state.pool, id).await?}),
    ))
}
