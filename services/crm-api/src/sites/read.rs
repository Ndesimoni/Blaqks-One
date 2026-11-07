use super::{
    access,
    model::{ProfileRow, SiteRow, COLUMNS},
    validation,
};
use crate::{
    error::{ApiError, ApiResult},
    workspaces,
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn company(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
) -> ApiResult<Option<SiteRow>> {
    Ok(sqlx::query_as(&format!(
        "SELECT {COLUMNS} FROM sites.crm_website_sites WHERE workspace=$1"
    ))
    .bind(workspace)
    .fetch_optional(&mut **tx)
    .await?)
}
pub async fn resolve(tx: &mut Transaction<'_, Postgres>, host: &str) -> ApiResult<SiteRow> {
    let normalized = validation::host(host).map_err(|_| ApiError::missing())?;
    let row:SiteRow=sqlx::query_as(&format!("SELECT {COLUMNS} FROM sites.crm_website_sites WHERE host=$1 AND active AND (kind='platform' OR entitled)"))
        .bind(normalized).fetch_optional(&mut **tx).await?.ok_or_else(ApiError::missing)?;
    if let Some(workspace) = &row.workspace {
        if !access::live_company(tx, workspace).await? {
            return Err(ApiError::missing());
        }
    }
    Ok(row)
}
pub async fn by_id(
    tx: &mut Transaction<'_, Postgres>,
    site: &str,
    host: &str,
) -> ApiResult<SiteRow> {
    let row = resolve(tx, host).await?;
    if row.id.to_string() != site {
        return Err(ApiError::missing());
    }
    Ok(row)
}
pub async fn profile(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
) -> ApiResult<Option<ProfileRow>> {
    Ok(sqlx::query_as("SELECT id,workspace,member,body,consent,can_publish,active,version FROM sites.crm_website_profiles WHERE id=$1")
        .bind(id).fetch_optional(&mut **tx).await?)
}
pub async fn usable_profile(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
) -> ApiResult<Option<ProfileRow>> {
    let Some(row) = profile(tx, id).await? else {
        return Ok(None);
    };
    if !row.active || !row.consent {
        return Ok(None);
    }
    let Some(member) = access::live_profile_member(tx, &row.workspace, row.member).await? else {
        return Ok(None);
    };
    if member.role != "admin" && !row.can_publish {
        return Ok(None);
    }
    Ok(Some(row))
}
pub async fn profile_recipient(
    tx: &mut Transaction<'_, Postgres>,
    site: &SiteRow,
    id: Uuid,
) -> ApiResult<(String, Uuid)> {
    let row = usable_profile(tx, id)
        .await?
        .ok_or_else(ApiError::missing)?;
    if site.workspace.as_ref().is_some_and(|w| w != &row.workspace) {
        return Err(ApiError::missing());
    }
    let company = company(tx, &row.workspace)
        .await?
        .ok_or_else(ApiError::missing)?;
    if !company.licence_verified || workspaces::frozen(tx, &row.workspace).await? {
        return Err(ApiError::missing());
    }
    Ok((row.workspace, row.member))
}

pub async fn public_company(
    tx: &mut Transaction<'_, Postgres>,
    site: &SiteRow,
    id: Uuid,
) -> ApiResult<SiteRow> {
    let row: SiteRow = sqlx::query_as(&format!(
        "SELECT {COLUMNS} FROM sites.crm_website_sites WHERE id=$1 AND kind='company' AND licence_verified"
    ))
    .bind(id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(ApiError::missing)?;
    let workspace = row.workspace.as_deref().ok_or_else(ApiError::missing)?;
    if site.workspace.as_ref().is_some_and(|w| w != workspace)
        || !access::live_company(tx, workspace).await?
    {
        return Err(ApiError::missing());
    }
    Ok(row)
}
