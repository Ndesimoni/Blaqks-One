//! The one visibility rule for profiles (review amendment 1), written once and used by the
//! profile read and its photo: the profile exists; the member is live in that same company and
//! is not the Super Admin and accepted the current terms; the company is approved, switched
//! on, not frozen and not the organisation workspace. Anything else is the shared not-found.
use super::{
    profiles::{self, Row},
    state::{self as market, State},
    terms,
};
use crate::{
    auth::members,
    error::ApiResult,
    workspaces::{self, ORGANISATION},
};
use sqlx::{Postgres, Transaction};

pub struct Visible {
    pub name: String,
    pub company: String,
    pub row: Row,
}

pub async fn visible(
    tx: &mut Transaction<'_, Postgres>,
    member: uuid::Uuid,
) -> ApiResult<Option<Visible>> {
    let Some(row) = profiles::load(tx, member).await? else {
        return Ok(None);
    };
    if row.workspace_id == ORGANISATION {
        return Ok(None);
    }
    let Some(name) = members::live_name(&mut **tx, &row.workspace_id, member).await? else {
        return Ok(None);
    };
    if workspaces::frozen(tx, &row.workspace_id).await? {
        return Ok(None);
    }
    let Some(current) = terms::current(tx).await? else {
        return Ok(None);
    };
    if !terms::accepted(tx, member, &current.version).await? {
        return Ok(None);
    }
    let latest = market::latest(tx, &row.workspace_id).await?;
    if market::state(&latest) != State::Approved {
        return Ok(None);
    }
    if !market::enabled(tx, &row.workspace_id).await?.0 {
        return Ok(None);
    }
    let company = workspaces::company::get(&mut **tx, &row.workspace_id).await?;
    let company = match company.display_name {
        Some(name) => name,
        None => owner_name(tx, &row.workspace_id).await?,
    };
    Ok(Some(Visible { name, company, row }))
}

/// The company's Admin name, shown when the company has not set a display name.
async fn owner_name(tx: &mut Transaction<'_, Postgres>, workspace: &str) -> ApiResult<String> {
    let owner = workspaces::owner_of(tx, workspace).await?;
    Ok(members::live_name(&mut **tx, workspace, owner)
        .await?
        .unwrap_or_default())
}
