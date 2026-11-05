//! Read limits against scraping (review amendment 9): 300 profile or photo reads an hour per
//! member, and 1,000 an hour per company across all its members.
use crate::{
    auth::throttle,
    error::{ApiError, ApiResult},
    state::AppState,
};
use uuid::Uuid;

pub const MEMBER: &str =
    "You have read 300 marketplace profiles in the last hour. Try again later.";
pub const COMPANY: &str =
    "Your company has read 1,000 marketplace profiles in the last hour. Try again later.";

pub async fn consume(state: &AppState, member: Uuid, workspace: &str) -> ApiResult<()> {
    let key = format!("market-read:{member}");
    throttle::consume_window(&state.pool, &key, 300, 3600, MEMBER, "rate_limited").await?;
    let key = format!("market-read-company:{workspace}");
    throttle::consume_window(&state.pool, &key, 1000, 3600, COMPANY, "rate_limited").await?;
    Ok(())
}

pub fn missing_id(text: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(text).map_err(|_| ApiError::missing())
}
