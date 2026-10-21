//! Sending addresses on the company's SendGrid domain (packet E3a, docs/sendgrid-design.md
//! §3): `GET/POST /workspaces/{ws}/email-addresses`. Only the company Admin manages them;
//! members never choose a From address. An address goes only to a live member with the
//! email grant, and a reserved address can return only to its own member (decision E3d).
mod change;
mod rules;
pub mod store;
pub mod write;

pub use change::{rename, reserve};

use super::{access, mailbox::may_connect, wire};
use crate::workspaces;
use crate::{auth::session::Session, error::ApiError, error::ApiResult, state::AppState};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

const FIELDS: [&str; 3] = ["memberId", "localPart", "displayName"];
pub const NO_SENDGRID: &str = "Connect the company's SendGrid account first.";
const NOT_MEMBER: &str = "Choose an active member of your team who may send email.";

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    access::ensure_reader(&state, &session, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    let domain = store::live_domain(&mut tx, &workspace).await?;
    let rows = match &domain {
        Some(domain) => store::list(&mut tx, &workspace, domain).await?,
        None => Vec::new(),
    };
    tx.commit().await?;
    let addresses: Vec<Value> = rows.iter().map(store::AddressRow::view).collect();
    Ok(Json(json!({ "domain": domain, "addresses": addresses })))
}

pub async fn create(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    access::ensure_admin(&state, &session, &headers, &workspace).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(wire::INVALID))?;
    let input = wire::exact(body, &["address"], wire::INVALID)?;
    let input = wire::exact(
        wire::node(&input, "address")?.clone(),
        &FIELDS,
        wire::INVALID,
    )?;
    let member = wire::node(&input, "memberId")?
        .as_str()
        .and_then(|value| Uuid::parse_str(value).ok())
        .ok_or(ApiError::invalid(NOT_MEMBER))?;
    let local = text(&input, "localPart").and_then(|value| rules::local_part(&value));
    let local = local.map_err(ApiError::invalid)?;
    let name = text(&input, "displayName").and_then(|value| rules::display_name(&value));
    let name = name.map_err(ApiError::invalid)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    access::live_admin(&mut tx, &workspace, session.user.id).await?;
    let domain = store::live_domain(&mut tx, &workspace)
        .await?
        .ok_or(ApiError::invalid(NO_SENDGRID))?;
    let user = workspaces::member(&mut tx, &workspace, member)
        .await
        .map_err(|_| ApiError::invalid(NOT_MEMBER))?;
    if !may_connect(&user, &workspace) {
        return Err(ApiError::invalid(NOT_MEMBER));
    }
    let id = match store::by_local(&mut tx, &workspace, &domain, &local).await? {
        None => {
            let new = store::NewAddress {
                workspace: &workspace,
                domain: &domain,
                local: &local,
                member,
                name: &name,
                actor: session.user.id,
            };
            store::insert(&mut tx, &new).await?
        }
        // A reserved address comes back only to the member it was made for.
        Some(found) if found.state == "reserved" && found.member_id == member => {
            let change = write::Change {
                workspace: &workspace,
                id: found.id,
                version: found.version,
                name: &name,
                state: "active",
                actor: session.user.id,
            };
            write::apply(&mut tx, &change).await?;
            found.id
        }
        Some(_) => return Err(ApiError::conflict(store::TAKEN)),
    };
    let row = store::by_id(&mut tx, &workspace, id)
        .await?
        .ok_or_else(ApiError::missing)?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "address": row.view() }))))
}

fn text(map: &serde_json::Map<String, Value>, key: &str) -> Result<String, &'static str> {
    map.get(key)
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or(wire::INVALID)
}
