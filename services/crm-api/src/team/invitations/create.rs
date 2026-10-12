use super::store;
use crate::team::{access, catalogue, members, validation};
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
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InviteRequest {
    pub name: String,
    pub email: String,
    pub phone: String,
    #[serde(default)]
    pub positions: Vec<String>,
    pub permissions: Option<Permissions>,
    pub channel_access: Option<ChannelAccess>,
    pub account_role: Option<String>,
}

pub async fn create(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<InviteRequest>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let owner = access::owner(&state, &session, &workspace).await?;
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let Json(mut request) =
        body.map_err(|_| ApiError::invalid("Provide valid invitation details."))?;
    request.name = request.name.trim().into();
    request.email = request.email.trim().to_lowercase();
    request.phone = request.phone.trim().into();
    validation::identity(&request.name, &request.email, &request.phone)?;
    let role = request.account_role.as_deref().unwrap_or("staff");
    let permissions = match role {
        "staff" => {
            let defaults = catalogue::defaults(&request.positions)
                .ok_or_else(|| ApiError::invalid("Select valid, distinct team positions."))?;
            request.permissions.clone().unwrap_or(defaults)
        }
        "admin" if access::can_manage_admin(&session, &workspace) => {
            request.positions.clear();
            Permissions::full()
        }
        _ => return Err(ApiError::forbidden()),
    };
    let created = store::create(
        &state.pool,
        session.user.id,
        owner,
        &workspace,
        &request,
        &permissions,
    )
    .await?;
    let member = members::find(&state.pool, created.id).await?;
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "member":member,
            "invitation":{"token":created.token,"expiresAt":created.expires_at}
        })),
    ))
}
