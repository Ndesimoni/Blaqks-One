//! The board against scraping (packet MK2): 120 reads an hour per member and 600 an hour per
//! company across all its members, and the opaque cursor that says where the next page starts.
use crate::{
    auth::throttle,
    error::{ApiError, ApiResult},
    state::AppState,
};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use uuid::Uuid;

pub const MEMBER: &str = "You have read the marketplace board 120 times in the last hour. \
     Try again later.";
pub const COMPANY: &str = "Your company has read the marketplace board 600 times in the last \
     hour. Try again later.";
const CURSOR: &str = "This page of the board is no longer valid. Reload the board.";

pub async fn consume(state: &AppState, member: Uuid, workspace: &str) -> ApiResult<()> {
    let key = format!("market-board:{member}");
    throttle::consume_window(&state.pool, &key, 120, 3600, MEMBER, "rate_limited").await?;
    let key = format!("market-board-company:{workspace}");
    throttle::consume_window(&state.pool, &key, 600, 3600, COMPANY, "rate_limited").await?;
    Ok(())
}

/// The pair a cursor names, refused when it is not one this server wrote.
pub fn parsed(value: &str) -> ApiResult<(String, Uuid)> {
    let (at, id) = value
        .split_once('|')
        .ok_or_else(|| ApiError::invalid(CURSOR))?;
    let id = Uuid::parse_str(id).map_err(|_| ApiError::invalid(CURSOR))?;
    if OffsetDateTime::parse(at, &Rfc3339).is_err() {
        return Err(ApiError::invalid(CURSOR));
    }
    Ok((at.to_owned(), id))
}
