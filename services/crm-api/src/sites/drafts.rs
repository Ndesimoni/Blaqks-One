use super::{access, model::SiteInput, store, validation};
use crate::{
    auth::{protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::http::HeaderMap;
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Save {
    pub version: i64,
    pub site: SiteInput,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Publish {
    pub version: i64,
}
async fn begin(
    state: &AppState,
    session: &Session,
    workspace: Option<&str>,
) -> ApiResult<Transaction<'static, Postgres>> {
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, workspace.unwrap_or(workspaces::ORGANISATION)).await?;
    if let Some(workspace) = workspace {
        access::owner(&mut tx, workspace, session.user.id).await?;
    } else {
        access::operator(&mut tx, session.user.id).await?;
    }
    Ok(tx)
}
pub async fn read(
    state: &AppState,
    session: &Session,
    workspace: Option<&str>,
) -> ApiResult<Value> {
    let mut tx = begin(state, session, workspace).await?;
    let row: Option<(i64, Value, bool)> =
        sqlx::query_as("SELECT version,body,active FROM sites.crm_website_drafts WHERE scope=$1")
            .bind(workspace.unwrap_or(workspaces::ORGANISATION))
            .fetch_optional(&mut *tx)
            .await?;
    tx.commit().await?;
    let version = row.as_ref().map_or(0, |r| r.0);
    Ok(
        json!({"version":version,"draft":row.filter(|r|r.2).map(|(version,site,_)|json!({"version":version,"site":site}))}),
    )
}
pub async fn save(
    state: &AppState,
    session: &Session,
    headers: &HeaderMap,
    workspace: Option<&str>,
    input: Save,
) -> ApiResult<Value> {
    protection::mutation(state, headers, &session.csrf_token)?;
    validation::site(&input.site)?;
    let mut tx = begin(state, session, workspace).await?;
    let scope = workspace.unwrap_or(workspaces::ORGANISATION);
    let prior: Option<i64> = sqlx::query_scalar(
        "SELECT version FROM sites.crm_website_drafts WHERE scope=$1 FOR UPDATE",
    )
    .bind(scope)
    .fetch_optional(&mut *tx)
    .await?;
    if prior.unwrap_or(0) != input.version {
        return Err(ApiError::stale(
            "The website draft has changed. Reload before saving.",
        ));
    }
    let body = serde_json::to_value(input.site)
        .map_err(|_| ApiError::invalid("Invalid website draft."))?;
    let version = input.version + 1;
    sqlx::query("INSERT INTO sites.crm_website_drafts(scope,version,body,updated_by) VALUES($1,$2,$3,$4) ON CONFLICT(scope) DO UPDATE SET version=EXCLUDED.version,body=EXCLUDED.body,updated_by=EXCLUDED.updated_by,active=true,updated_at=now()")
        .bind(scope).bind(version).bind(&body).bind(session.user.id).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(json!({"draft":{"version":version,"site":body},"state":"draft"}))
}
pub async fn publish(
    state: &AppState,
    session: &Session,
    headers: &HeaderMap,
    workspace: Option<&str>,
    input: Publish,
) -> ApiResult<Value> {
    protection::mutation(state, headers, &session.csrf_token)?;
    let mut tx = begin(state, session, workspace).await?;
    let scope = workspace.unwrap_or(workspaces::ORGANISATION);
    let (version, body, active): (i64, Value, bool) = sqlx::query_as(
        "SELECT version,body,active FROM sites.crm_website_drafts WHERE scope=$1 FOR UPDATE",
    )
    .bind(scope)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(ApiError::missing)?;
    if version != input.version || !active {
        return Err(ApiError::stale(
            "The website draft has changed. Reload before publishing.",
        ));
    }
    let body: SiteInput =
        serde_json::from_value(body).map_err(|_| ApiError::invalid("Invalid website draft."))?;
    let site = store::save(&mut tx, workspace, session.user.id, &body).await?;
    sqlx::query("UPDATE sites.crm_website_drafts SET active=false,version=version+1,updated_at=now() WHERE scope=$1")
        .bind(scope)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(json!({"site":site,"state":"published"}))
}
