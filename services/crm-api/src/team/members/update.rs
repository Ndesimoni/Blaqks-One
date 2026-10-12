use super::{directory, update_store};
use crate::team::{access, catalogue, validation};
use crate::{
    auth::{
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
}

pub fn prepare(request: &mut UpdateRequest, current: &directory::MemberRow) -> ApiResult<()> {
    if request.version < 1 {
        return Err(ApiError::invalid("A positive member version is required."));
    }
    request.name = Some(
        request
            .name
            .as_deref()
            .unwrap_or(&current.user.name)
            .trim()
            .into(),
    );
    request.phone = Some(
        request
            .phone
            .as_deref()
            .unwrap_or(&current.user.phone)
            .trim()
            .into(),
    );
    validation::identity(
        request.name.as_deref().unwrap(),
        &current.user.email,
        request.phone.as_deref().unwrap(),
    )?;
    if !current.accepted && request.active == Some(true) {
        return Err(ApiError::conflict(
            "Activate the invitation before enabling this account.",
        ));
    }
    if current.user.role == "admin" {
        request.positions = Some(vec![]);
        request.permissions = Some(Permissions::full());
    } else {
        let selected = request
            .positions
            .clone()
            .unwrap_or_else(|| current.user.positions.0.clone());
        let defaults = catalogue::defaults(&selected)
            .ok_or_else(|| ApiError::invalid("Select valid, distinct team positions."))?;
        request.permissions = Some(request.permissions.clone().unwrap_or_else(|| {
            if request.positions.is_some() {
                defaults
            } else {
                current.user.permissions.0.clone()
            }
        }));
        request.positions = Some(selected);
    }
    request.channel_access = Some(
        request
            .channel_access
            .clone()
            .unwrap_or_else(|| current.user.channel_access.0.clone()),
    );
    Ok(())
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
