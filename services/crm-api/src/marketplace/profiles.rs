//! Stored marketplace profiles: load, insert, edit, remove, and the two views — the member's
//! own profile and what another joined member may read.
use super::{
    profile::{self, Community},
    terms,
};
use crate::error::ApiResult;
use serde_json::{json, Value};
use sqlx::{types::Json, Postgres, Transaction};
use uuid::Uuid;

const STAMP: &str = "to_char(joined_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')";
const COLUMNS: &str = "member_id,workspace_id,emirates,communities,property_types,\
                       experience_years,licence_number,licence_authority,photo_id";

#[derive(Debug, sqlx::FromRow)]
pub struct Row {
    pub member_id: Uuid,
    pub workspace_id: String,
    pub emirates: Vec<String>,
    pub communities: Json<Vec<Community>>,
    pub property_types: Vec<String>,
    pub experience_years: i16,
    pub licence_number: Option<String>,
    pub licence_authority: Option<String>,
    pub photo_id: Option<Uuid>,
    pub joined_at: String,
    pub version: i64,
}

pub async fn load(tx: &mut Transaction<'_, Postgres>, member: Uuid) -> ApiResult<Option<Row>> {
    Ok(sqlx::query_as(&format!(
        "SELECT {COLUMNS},{STAMP} AS joined_at,version \
         FROM marketplace.crm_market_profiles WHERE member_id=$1"
    ))
    .bind(member)
    .fetch_optional(&mut **tx)
    .await?)
}

pub async fn insert(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    member: Uuid,
    valid: profile::Valid,
) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO marketplace.crm_market_profiles (member_id,workspace_id,emirates, \
         communities,property_types,experience_years,licence_number,licence_authority) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    )
    .bind(member)
    .bind(workspace)
    .bind(&valid.emirates)
    .bind(Json(valid.communities))
    .bind(&valid.property_types)
    .bind(valid.experience_years)
    .bind(&valid.licence_number)
    .bind(&valid.licence_authority)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn update(
    tx: &mut Transaction<'_, Postgres>,
    member: Uuid,
    expected: i64,
    valid: profile::Valid,
) -> ApiResult<Option<Row>> {
    Ok(sqlx::query_as(&format!(
        "UPDATE marketplace.crm_market_profiles SET emirates=$3,communities=$4, \
         property_types=$5,experience_years=$6,licence_number=$7,licence_authority=$8, \
         updated_at=now(),version=version+1 \
         WHERE member_id=$1 AND version=$2 \
         RETURNING {COLUMNS},{STAMP} AS joined_at,version"
    ))
    .bind(member)
    .bind(expected)
    .bind(&valid.emirates)
    .bind(Json(valid.communities))
    .bind(&valid.property_types)
    .bind(valid.experience_years)
    .bind(&valid.licence_number)
    .bind(&valid.licence_authority)
    .fetch_optional(&mut **tx)
    .await?)
}

/// Sets or clears the photo and moves the profile version on.
pub async fn set_photo(
    tx: &mut Transaction<'_, Postgres>,
    member: Uuid,
    photo: Option<Uuid>,
) -> ApiResult<Option<Row>> {
    Ok(sqlx::query_as(&format!(
        "UPDATE marketplace.crm_market_profiles SET photo_id=$2,updated_at=now(), \
         version=version+1 WHERE member_id=$1 \
         RETURNING {COLUMNS},{STAMP} AS joined_at,version"
    ))
    .bind(member)
    .bind(photo)
    .fetch_optional(&mut **tx)
    .await?)
}

pub async fn remove(tx: &mut Transaction<'_, Postgres>, member: Uuid) -> ApiResult<()> {
    sqlx::query("DELETE FROM marketplace.crm_market_profiles WHERE member_id=$1")
        .bind(member)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

/// The `member` part of the status: joined, the own profile, and the current terms.
pub async fn status(tx: &mut Transaction<'_, Postgres>, member: Uuid) -> ApiResult<Value> {
    let current = terms::current(tx).await?;
    let accepted = match &current {
        Some(terms) => terms::accepted(tx, member, &terms.version).await?,
        None => false,
    };
    let row = load(tx, member).await?;
    Ok(json!({
        "joined": row.is_some(),
        "profile": row.map(|row| row.own()),
        "termsCurrent": accepted,
        "termsVersion": current.as_ref().map(|terms| terms.version.clone()),
        "termsDigest": current.as_ref().map(|terms| terms.digest.clone()),
    }))
}
