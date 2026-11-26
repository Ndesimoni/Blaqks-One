//! Website figures for Blaqks One's dashboard (BO1d, docs/blaqks-one-console.md §3 item 4):
//! how many company websites are live and whether the general site is. A site is live as
//! the public read sees it (`read.rs`): active, and entitled unless it is the general site.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};

/// Company websites live, and whether the general site is live.
pub async fn live(tx: &mut Transaction<'_, Postgres>) -> ApiResult<(i64, bool)> {
    sqlx::query_as(
        "SELECT count(*) FILTER (WHERE kind='company' AND active AND entitled), \
         COALESCE(bool_or(kind='platform' AND active),false) FROM sites.crm_website_sites",
    )
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}
