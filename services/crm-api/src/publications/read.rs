use super::model::{Publication, Recipient, COLUMNS};
use crate::{
    error::{ApiError, ApiResult},
    media,
    sites::{self, SiteRow},
    state::AppState,
    workspaces,
};
use axum::response::Response;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn eligible(tx: &mut Transaction<'_, Postgres>, row: &Publication) -> ApiResult<bool> {
    if !row.active || !sites::access::live_company(tx, &row.workspace).await? {
        return Ok(false);
    }
    let Some(company) = sites::read::company(tx, &row.workspace).await? else {
        return Ok(false);
    };
    if !company.licence_verified {
        return Ok(false);
    }
    let Some(profile) = sites::read::usable_profile(tx, row.profile).await? else {
        return Ok(false);
    };
    if profile.workspace != row.workspace || profile.member != row.member {
        return Ok(false);
    }
    let Some(member) = sites::access::live_profile_member(tx, &row.workspace, row.member).await?
    else {
        return Ok(false);
    };
    if !crate::records::publication_source::eligible(tx, &row.workspace, row.record, &member)
        .await?
    {
        return Ok(false);
    }
    let ids: Vec<_> = row.photos.iter().chain(&row.floor_plans).copied().collect();
    media::public_assets::available(tx, &row.workspace, row.revision, &ids).await
}
pub async fn visible(
    tx: &mut Transaction<'_, Postgres>,
    site: &SiteRow,
) -> ApiResult<Vec<Publication>> {
    let rows:Vec<Publication>=sqlx::query_as(&format!("SELECT {COLUMNS} FROM publications.crm_website_listings WHERE active AND ($1::text IS NULL OR workspace=$1) AND ($1::text IS NOT NULL OR destination='general_and_company') ORDER BY published_at DESC,id LIMIT 1001"))
        .bind(&site.workspace).fetch_all(&mut **tx).await?;
    if rows.len() > 1000 {
        return Err(ApiError::conflict(
            "The public catalogue requires a narrower query.",
        ));
    }
    let mut visible = Vec::new();
    for row in rows {
        if eligible(tx, &row).await? {
            visible.push(row);
        }
    }
    Ok(visible)
}
pub async fn recipient(
    tx: &mut Transaction<'_, Postgres>,
    site: &SiteRow,
    listing: Uuid,
) -> ApiResult<Recipient> {
    let row = visible(tx, site)
        .await?
        .into_iter()
        .find(|row| row.id == listing)
        .ok_or_else(ApiError::missing)?;
    let owner = workspaces::owner_of(tx, &row.workspace).await?;
    Ok(Recipient {
        workspace: row.workspace,
        owner,
        agent: Some(row.member),
        publication: row.id,
        profile: row.profile,
        revision: row.revision,
    })
}
pub async fn public_file(
    state: &AppState,
    tx: &mut Transaction<'_, Postgres>,
    site: &SiteRow,
    file: Uuid,
) -> ApiResult<Response> {
    let row = visible(tx, site)
        .await?
        .into_iter()
        .find(|row| row.photos.contains(&file) || row.floor_plans.contains(&file))
        .ok_or_else(ApiError::missing)?;
    media::public_assets::serve(state, tx, &row.workspace, row.revision, file).await
}
