//! Participant-only marketplace messaging; company Admin status grants no access.
use super::{gate, requests, sources, visibility};
use crate::{
    error::{ApiError, ApiResult},
    records::market_requirements,
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

#[derive(sqlx::FromRow)]
pub struct Conversation {
    pub id: Uuid,
    pub request_id: Uuid,
    pub broker_id: Uuid,
    pub broker_workspace: String,
}

pub async fn request(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> ApiResult<requests::Row> {
    sqlx::query("SELECT id FROM marketplace.crm_market_requests WHERE id=$1 FOR UPDATE")
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(ApiError::missing)?;
    let row = requests::load(tx, id)
        .await?
        .ok_or_else(ApiError::missing)?;
    visibility::visible(tx, row.member_id)
        .await?
        .ok_or_else(ApiError::missing)?;
    let client = sources::client_of(tx, id)
        .await?
        .ok_or_else(ApiError::missing)?;
    let held =
        market_requirements::still_held(tx, &[(row.workspace_id.clone(), client, row.member_id)])
            .await?;
    if !held.contains(&client) {
        return Err(ApiError::missing());
    }
    Ok(row)
}

pub fn open(row: &requests::Row) -> ApiResult<()> {
    if row.closed_at.is_some() || row.expired || row.paused_at.is_some() {
        return Err(ApiError::conflict(
            "This request is not accepting messages or offers.",
        ));
    }
    Ok(())
}

pub async fn load(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    actor: Uuid,
) -> ApiResult<(Conversation, requests::Row)> {
    let room: Conversation = sqlx::query_as("SELECT id,request_id,broker_id,broker_workspace FROM marketplace.crm_market_conversations WHERE id=$1")
        .bind(id).fetch_optional(&mut **tx).await?.ok_or_else(ApiError::missing)?;
    let row = request(tx, room.request_id).await?;
    if actor != room.broker_id && actor != row.member_id {
        return Err(ApiError::missing());
    }
    gate::company_open_or_missing(tx, &room.broker_workspace).await?;
    visibility::visible(tx, room.broker_id)
        .await?
        .ok_or_else(ApiError::missing)?;
    Ok((room, row))
}

pub fn body(body: &str) -> ApiResult<String> {
    let body = body.trim();
    if body.is_empty()
        || body.chars().count() > 2000
        || body.chars().any(|c| c.is_control() && c != '\n')
    {
        return Err(ApiError::invalid("Write a message of 1–2000 characters."));
    }
    if super::free_text::carries_contact(&[body]) {
        return Err(ApiError::invalid(
            "Keep contact details and links out of marketplace messages.",
        ));
    }
    Ok(body.to_owned())
}
