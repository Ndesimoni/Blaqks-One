use super::store;
use crate::team::{access, catalogue, members, members::prepare, validation};
use crate::{
    auth::{
        actions::Actions,
        finance_access::{self, FinanceActions},
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
    /// Staff action grants; `deleteMain` may be omitted and can never be true here.
    pub actions: Option<Value>,
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
    let (permissions, actions) = match role {
        "staff" => {
            let defaults = catalogue::defaults(&request.positions)
                .ok_or_else(|| ApiError::invalid("Select valid, distinct team positions."))?;
            let permissions = request.permissions.clone().unwrap_or(defaults);
            let actions = staff_actions(request.actions.take(), &permissions)?;
            (permissions, Some(actions))
        }
        "admin" if access::can_manage_admin(&session, &workspace) => {
            if request.actions.is_some() {
                return Err(ApiError::invalid(prepare::STAFF_ONLY));
            }
            request.positions.clear();
            (Permissions::full(), None)
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
        actions.as_ref(),
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

/// Presets by default; explicit grants are decoded strictly and normalised. New
/// members are assigned-only, so deleteMain, finance approve and teamView are refused
/// (L-2, finance-design §5.1). An omitted `finance` key takes the finance preset.
fn staff_actions(value: Option<Value>, permissions: &Permissions) -> ApiResult<Actions> {
    let Some(value) = value else {
        return Ok(Actions::preset(permissions));
    };
    let finance_given = value.get("finance").is_some();
    let mut actions = Actions::from_invitation(value)
        .ok_or_else(|| ApiError::invalid("Provide valid invitation details."))?;
    if actions.deletes_main() {
        return Err(ApiError::invalid(prepare::DELETE_NEEDS_TEAM));
    }
    if actions.finance.approve || actions.finance.team_view {
        return Err(ApiError::invalid(finance_access::NEEDS_TEAM));
    }
    if !finance_given {
        actions.finance = FinanceActions::preset(permissions);
    }
    Ok(actions.normalised(permissions, false))
}
