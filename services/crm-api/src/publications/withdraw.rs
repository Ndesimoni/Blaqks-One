use super::model::{Publication, WithdrawInput, COLUMNS};
use crate::{
    auth::{protection, session::Session},
    error::{ApiError, ApiResult},
    sites,
    state::AppState,
    workspaces,
};
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    let mut tx = state.pool.begin().await?;
    let live = sites::access::member(&mut tx, &workspace, session.user.id).await?;
    if !live.can_collection("Properties") {
        return Err(ApiError::forbidden());
    }
    let rows:Vec<Publication>=sqlx::query_as(&format!("SELECT {COLUMNS},published_at::text AS published_at FROM publications.crm_website_listings WHERE workspace=$1 AND ($2 OR member=$3) ORDER BY published_at DESC LIMIT 501"))
        .bind(&workspace).bind(live.role=="admin").bind(live.id).fetch_all(&mut *tx).await?;
    let rows:Vec<_>=rows.into_iter().map(|p|json!({"id":p.id,"recordId":p.record,"agentProfileId":p.profile,"version":p.version,"sourceVersion":p.source_version,"active":p.active,"destination":p.destination,"publishedAt":p.published_at,"snapshot":p.snapshot["listing"]})).collect();
    tx.commit().await?;
    Ok(Json(json!({"publications":rows})))
}
pub async fn withdraw(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, id)): Path<(String, Uuid)>,
    headers: HeaderMap,
    Json(input): Json<WithdrawInput>,
) -> ApiResult<Json<Value>> {
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let live = sites::access::member(&mut tx, &workspace, session.user.id).await?;
    let row:Publication=sqlx::query_as(&format!("SELECT {COLUMNS} FROM publications.crm_website_listings WHERE id=$1 AND workspace=$2 FOR UPDATE"))
        .bind(id).bind(&workspace).fetch_optional(&mut *tx).await?.ok_or_else(ApiError::missing)?;
    if live.role != "admin" && row.member != live.id {
        return Err(ApiError::forbidden());
    }
    if row.version != input.version {
        return Err(ApiError::stale(
            "The public listing has changed. Reload and try again.",
        ));
    }
    deactivate(&mut tx, &row, live.id).await?;
    crate::records::audit::append(
        &mut tx,
        live.id,
        &workspace,
        "updated",
        "Properties",
        row.record,
    )
    .await?;
    tx.commit().await?;
    Ok(Json(
        json!({"publication":{"id":id,"version":row.version+1,"state":"withdrawn"}}),
    ))
}
async fn deactivate(
    tx: &mut Transaction<'_, Postgres>,
    row: &Publication,
    actor: Uuid,
) -> ApiResult<()> {
    sqlx::query(
        "UPDATE publications.crm_website_listings SET active=false,version=version+1 WHERE id=$1",
    )
    .bind(row.id)
    .execute(&mut **tx)
    .await?;
    sqlx::query("INSERT INTO publications.crm_website_listing_revisions(id,publication,workspace,actor,version,source_version,snapshot,photos,floor_plans,action) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'withdraw')")
        .bind(Uuid::new_v4()).bind(row.id).bind(&row.workspace).bind(actor).bind(row.version+1).bind(row.source_version).bind(&row.snapshot).bind(&row.photos).bind(&row.floor_plans).execute(&mut **tx).await?;
    Ok(())
}
pub async fn revoke_member(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    member: Uuid,
    actor: Uuid,
) -> ApiResult<()> {
    let rows:Vec<Publication>=sqlx::query_as(&format!("SELECT {COLUMNS} FROM publications.crm_website_listings WHERE workspace=$1 AND member=$2 AND active ORDER BY id FOR UPDATE"))
        .bind(workspace).bind(member).fetch_all(&mut **tx).await?;
    for row in rows {
        deactivate(tx, &row, actor).await?;
    }
    Ok(())
}
