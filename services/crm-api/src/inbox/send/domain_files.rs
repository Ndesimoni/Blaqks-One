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
use std::time::Duration;
use uuid::Uuid;

/// Reading the files may take this long before the send retries. With the provider's
/// longest call it stays inside the outbox's call budget (F3a review M1).
pub const STORAGE_DEADLINE: Duration = Duration::from_secs(8);

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
    let missing = Delivery::Failed {
        code: "attachment_missing",
    };
    // No original found (a chain too long to follow): never send without its files.
    let Some(owner) = root else {
        return Err(missing);
    };
    let read = contents::of_owner(pool, media, &job.workspace_id, KIND, owner);
    match tokio::time::timeout(STORAGE_DEADLINE, read).await {
        Ok(Ok(files)) => Ok(files),
        Ok(Err(Unreadable::Missing)) => Err(missing),
        Ok(Err(Unreadable::Unavailable)) | Err(_) => Err(unavailable),
    }
}

#[cfg(test)]
mod tests {
    use super::STORAGE_DEADLINE;
    use crate::{integrations::mail::SEND_TIMEOUT_MAX, outbox::model::CALL_TIMEOUT};

    #[test]
    fn reading_files_and_the_largest_send_fit_the_outbox_call_budget() {
        assert!(STORAGE_DEADLINE + SEND_TIMEOUT_MAX < CALL_TIMEOUT);
    }
}
