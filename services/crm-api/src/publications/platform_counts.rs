//! Listings live on the websites, for Blaqks One's dashboard (BO1d,
//! docs/blaqks-one-console.md §3 item 4): a count only.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};

pub async fn live(tx: &mut Transaction<'_, Postgres>) -> ApiResult<i64> {
    sqlx::query_scalar("SELECT count(*) FROM publications.crm_website_listings WHERE active")
        .fetch_one(&mut **tx)
        .await
        .map_err(Into::into)
}
