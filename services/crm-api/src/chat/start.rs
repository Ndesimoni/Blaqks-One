//! `POST /chat/channels` (the Admin names a channel open to the whole company) and
//! `POST /chat/direct` (opens, or returns, the private conversation with one colleague).
use super::{access, wire};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

const NAME: &str =
    "Use 1–40 lower-case letters, digits or hyphens, starting with a letter or digit.";
const TAKEN: &str = "A channel with this name already exists.";
const COLLEAGUE: &str = "Choose a colleague in your company.";

fn channel_name(value: Option<&Value>) -> ApiResult<String> {
    let name = value
        .and_then(Value::as_str)
        .map(|text| text.trim().trim_start_matches('#').to_ascii_lowercase())
        .unwrap_or_default();
    let valid = (1..=40).contains(&name.len())
        && name
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        && !name.starts_with('-');
    valid.then_some(name).ok_or(ApiError::invalid(NAME))
}

pub async fn channel(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    access::ensure(&state, &session, Some(&headers), &workspace).await?;
    let map = wire::exact(body, &["name"], NAME)?;
    let name = channel_name(map.get("name"))?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    // Only the Admin creates channels (owner decision 2026-10-21).
    if user.role != "admin" {
        return Err(ApiError::forbidden());
    }
    let id = Uuid::new_v4();
    let created = sqlx::query(
        "INSERT INTO chat.crm_chat_rooms (id,workspace_id,kind,name,created_by) \
         VALUES ($1,$2,'channel',$3,$4) \
         ON CONFLICT (workspace_id,name) WHERE kind='channel' DO NOTHING",
    )
    .bind(id)
    .bind(&workspace)
    .bind(&name)
    .bind(user.id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if created == 0 {
        return Err(ApiError::conflict(TAKEN));
    }
    tx.commit().await?;
    let room = json!({"id": id, "kind": "channel", "name": name, "peerId": null, "unread": 0});
    Ok((StatusCode::CREATED, Json(json!({ "room": room }))))
}

pub async fn direct(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    access::ensure(&state, &session, Some(&headers), &workspace).await?;
    let map = wire::exact(body, &["memberId"], COLLEAGUE)?;
    let peer = map
        .get("memberId")
        .and_then(Value::as_str)
        .and_then(|value| Uuid::parse_str(value).ok())
        .filter(|id| *id != session.user.id)
        .ok_or(ApiError::invalid(COLLEAGUE))?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    // The colleague must be a live member of the same company.
    access::live(&mut tx, &workspace, peer)
        .await
        .map_err(|_| ApiError::invalid(COLLEAGUE))?;
    let (low, high) = if user.id < peer {
        (user.id, peer)
    } else {
        (peer, user.id)
    };
    let key = format!("{low}:{high}");
    let existing: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM chat.crm_chat_rooms WHERE workspace_id=$1 AND kind='direct' \
         AND direct_key=$2",
    )
    .bind(&workspace)
    .bind(&key)
    .fetch_optional(&mut *tx)
    .await?;
    let id = match existing {
        Some(id) => id,
        None => wire::open_direct(&mut tx, &workspace, &key, user.id, [low, high]).await?,
    };
    tx.commit().await?;
    let room = json!({"id": id, "kind": "direct", "name": null, "peerId": peer});
    Ok(Json(json!({ "room": room })))
}

#[cfg(test)]
mod tests {
    use super::channel_name;
    use serde_json::json;

    #[test]
    fn channel_names_are_plain_and_bounded() {
        assert_eq!(
            channel_name(Some(&json!(" #Sales-Team "))).unwrap(),
            "sales-team"
        );
        for bad in [
            json!(""),
            json!("-x"),
            json!("two words"),
            json!("a".repeat(41)),
            json!(5),
        ] {
            assert!(channel_name(Some(&bad)).is_err());
        }
    }
}
