//! The reply's side of drafts (docs/saved-replies-drafts.md §3): sending empties the
//! writer's draft in the reply's own transaction.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// In the reply's own transaction: the writer's draft is emptied, or an empty one made, and
/// its revision moved on, so no save based on an earlier one, even revision 0, can bring the
/// sent text back (code review H1). Answers the new revision.
pub async fn sent(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    id: Uuid,
    member: Uuid,
) -> ApiResult<i64> {
    Ok(sqlx::query_scalar(
        "INSERT INTO inbox.crm_inbox_drafts (conversation_id,member_id,workspace_id,body) \
         VALUES ($1,$2,$3,NULL) ON CONFLICT (conversation_id,member_id) DO UPDATE \
         SET body=NULL,revision=inbox.crm_inbox_drafts.revision+1,updated_at=now() \
         RETURNING revision",
    )
    .bind(id)
    .bind(member)
    .bind(workspace)
    .fetch_one(&mut **tx)
    .await?)
}
