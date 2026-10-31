use super::{input, recipient, store};
use crate::{
    error::{ApiError, ApiResult},
    records::website_lead,
    sites,
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, ConnectInfo, Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::net::SocketAddr;

#[derive(Deserialize)]
pub struct Host {
    pub host: String,
}

pub async fn submit(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(site_id): Path<String>,
    Query(host): Query<Host>,
    headers: HeaderMap,
    body: Result<Json<input::Input>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let key = input::key(&headers)?;
    let Json(body) = body.map_err(|_| ApiError::invalid("Provide a valid enquiry."))?;
    let body = input::prepare(body)?;
    let hash = input::payload_hash(&body)?;
    let client = state.signup.clients.digest(peer, &headers)?;
    crate::auth::throttle::consume_window(
        &state.pool,
        &format!("website:intake:attempt:{client}"),
        60,
        300,
        "Too many enquiries. Try again later.",
        "rate_limited",
    )
    .await?;
    let mut tx = state.pool.begin().await?;
    let site = sites::by_id(&mut tx, &site_id, &host.host).await?;
    let key = crate::auth::session::digest(&format!("{}:{key}", site.host));
    store::lock(&mut tx, site.id, &key).await?;
    if let Some(receipt) = store::previous(&mut tx, site.id, &key, &hash).await? {
        tx.commit().await?;
        return Ok((
            StatusCode::OK,
            Json(json!({"receipt":receipt,"status":"received"})),
        ));
    }
    let target = recipient::resolve(&mut tx, &site, &body).await?;
    workspaces::lock(&mut tx, &target.workspace).await?;
    let site = sites::by_id(&mut tx, &site_id, &host.host).await?;
    let current = recipient::resolve(&mut tx, &site, &body).await?;
    if current.workspace != target.workspace {
        return Err(ApiError::missing());
    }
    let contacts: Vec<String> = [body.email.as_deref(), body.phone.as_deref()]
        .into_iter()
        .flatten()
        .map(|contact| format!("{}:{contact}", state.config.client_secret))
        .collect();
    store::budget(&mut tx, site.id, &client, &contacts).await?;
    let lead = website_lead::create_in(
        &mut tx,
        &current.workspace,
        current.owner,
        current.agent,
        &website_lead::Contact {
            name: &body.name,
            email: body.email.as_deref(),
            phone: body.phone.as_deref(),
            message: &body.message,
            preference: body.contact_preference.as_deref(),
        },
    )
    .await?;
    let receipt = store::save(&mut tx, &site, &key, &hash, &body, &current, &lead).await?;
    tx.commit().await?;
    Ok((
        StatusCode::CREATED,
        Json(json!({"receipt":receipt,"status":"received"})),
    ))
}
