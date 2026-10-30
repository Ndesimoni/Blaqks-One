use super::{
    access,
    model::{GrantInput, ProfileInput, ProfileRow},
    read, store, validation,
};
use crate::{
    auth::{protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

/// Every public profile in the company, for the owning Admin's Team tab.
pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    let mut tx = state.pool.begin().await?;
    access::owner(&mut tx, &workspace, session.user.id).await?;
    let rows: Vec<ProfileRow> = sqlx::query_as(
        "SELECT id,workspace,member,body,consent,can_publish,active,version \
         FROM sites.crm_website_profiles WHERE workspace=$1 ORDER BY member LIMIT 500",
    )
    .bind(&workspace)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(json!({ "profiles": rows })))
}

pub async fn get(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, member)): Path<(String, Uuid)>,
) -> ApiResult<Json<Value>> {
    let mut tx = state.pool.begin().await?;
    let live = access::member(&mut tx, &workspace, session.user.id).await?;
    if live.id != member && live.role != "admin" {
        return Err(ApiError::forbidden());
    }
    let row:Option<ProfileRow>=sqlx::query_as("SELECT id,workspace,member,body,consent,can_publish,active,version FROM sites.crm_website_profiles WHERE workspace=$1 AND member=$2")
        .bind(&workspace).bind(member).fetch_optional(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(json!({"profile":row})))
}

pub async fn update(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, member)): Path<(String, Uuid)>,
    headers: HeaderMap,
    Json(input): Json<ProfileInput>,
) -> ApiResult<Json<Value>> {
    protection::mutation(&state, &headers, &session.csrf_token)?;
    validation::profile(&input)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let live = access::member(&mut tx, &workspace, session.user.id).await?;
    if live.id != member && live.role != "admin" {
        return Err(ApiError::forbidden());
    }
    if access::live_profile_member(&mut tx, &workspace, member)
        .await?
        .is_none()
    {
        return Err(ApiError::missing());
    }
    let company = read::company(&mut tx, &workspace)
        .await?
        .ok_or_else(|| ApiError::conflict("Set up your website details first."))?;
    let previous:Option<ProfileRow>=sqlx::query_as("SELECT id,workspace,member,body,consent,can_publish,active,version FROM sites.crm_website_profiles WHERE workspace=$1 AND member=$2 FOR UPDATE")
        .bind(&workspace).bind(member).fetch_optional(&mut *tx).await?;
    if previous.as_ref().map_or(0, |p| p.version) != input.version {
        return Err(ApiError::stale(
            "The public profile has changed. Reload and try again.",
        ));
    }
    // Only the member gives or withdraws consent; an Admin's edit keeps it as it is.
    if live.id != member && input.consent != previous.as_ref().is_some_and(|p| p.consent) {
        return Err(ApiError::forbidden());
    }
    let id = previous.as_ref().map_or_else(Uuid::new_v4, |p| p.id);
    let body = json!({"id":id,"company":company.id,"name":input.name,"specialty":input.specialty,"publicWhatsApp":input.public_whats_app,"publicEmail":input.public_email});
    let row:ProfileRow=sqlx::query_as("INSERT INTO sites.crm_website_profiles(id,workspace,member,body,consent,active) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(workspace,member) DO UPDATE SET body=EXCLUDED.body,consent=EXCLUDED.consent,active=EXCLUDED.active,version=sites.crm_website_profiles.version+1,updated_at=now() RETURNING id,workspace,member,body,consent,can_publish,active,version")
        .bind(id).bind(&workspace).bind(member).bind(body).bind(input.consent).bind(input.active).fetch_one(&mut *tx).await?;
    if !row.active || !row.consent {
        crate::publications::withdraw::revoke_member(&mut tx, &workspace, member, live.id).await?;
    }
    store::profile_version(&mut tx, &row, live.id, "profile_published").await?;
    store::event(&mut tx, &company, live.id, "profile_published").await?;
    tx.commit().await?;
    Ok(Json(json!({"profile":row})))
}
pub async fn grant(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, member)): Path<(String, Uuid)>,
    headers: HeaderMap,
    Json(input): Json<GrantInput>,
) -> ApiResult<Json<Value>> {
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    access::owner(&mut tx, &workspace, session.user.id).await?;
    if access::live_profile_member(&mut tx, &workspace, member)
        .await?
        .is_none()
    {
        return Err(ApiError::missing());
    }
    let row:ProfileRow=sqlx::query_as("UPDATE sites.crm_website_profiles SET can_publish=$3,version=version+1,updated_at=now() WHERE workspace=$1 AND member=$2 AND version=$4 RETURNING id,workspace,member,body,consent,can_publish,active,version")
        .bind(&workspace).bind(member).bind(input.can_publish).bind(input.version).fetch_optional(&mut *tx).await?.ok_or_else(||ApiError::stale("The public profile has changed. Reload and try again."))?;
    if !row.can_publish {
        crate::publications::withdraw::revoke_member(&mut tx, &workspace, member, session.user.id)
            .await?;
    }
    store::profile_version(&mut tx, &row, session.user.id, "publish_grant_changed").await?;
    let company = read::company(&mut tx, &workspace)
        .await?
        .ok_or_else(ApiError::missing)?;
    store::event(&mut tx, &company, session.user.id, "publish_grant_changed").await?;
    tx.commit().await?;
    Ok(Json(json!({"profile":row})))
}
