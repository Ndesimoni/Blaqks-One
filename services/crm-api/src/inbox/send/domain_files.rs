//! The files a queued email sends (F3a): those of its original message, followed back
//! through `repeat_of`, read only by that owner in the message's own company (F3 review
//! M5). A file that is gone, hidden or altered fails the send for good; storage that cannot
//! answer now retries, before any provider call.
use super::files::KIND;
use crate::{
    config::media_settings::MediaConfig,
    integrations::mail::Delivery,
    media::contents::{self, File, Unreadable},
    outbox::model::Job,
};
use sqlx::PgPool;
use uuid::Uuid;

const ROOT: &str = "WITH RECURSIVE chain(id,repeat_of,depth) AS ( \
    SELECT id,repeat_of,0 FROM inbox.crm_inbox_messages WHERE id=$1 AND workspace_id=$2 \
    UNION ALL SELECT m.id,m.repeat_of,c.depth+1 FROM inbox.crm_inbox_messages m \
      JOIN chain c ON m.id=c.repeat_of WHERE c.depth<50 AND m.workspace_id=$2) \
    SELECT id FROM chain WHERE repeat_of IS NULL LIMIT 1";

pub async fn load(
    pool: &PgPool,
    media: Option<&MediaConfig>,
    job: &Job,
) -> Result<Vec<File>, Delivery> {
    let unavailable = Delivery::Retry {
        after: None,
        code: "storage_unavailable",
    };
    let root: Option<Uuid> = sqlx::query_scalar(ROOT)
        .bind(job.object_id)
        .bind(&job.workspace_id)
        .fetch_optional(pool)
        .await
        .map_err(|_| Delivery::Retry {
            after: None,
            code: "database",
        })?;
    let owner = root.unwrap_or(job.object_id);
    match contents::of_owner(pool, media, &job.workspace_id, KIND, owner).await {
        Ok(files) => Ok(files),
        Err(Unreadable::Unavailable) => Err(unavailable),
        Err(Unreadable::Missing) => Err(Delivery::Failed {
            code: "attachment_missing",
        }),
    }
}
