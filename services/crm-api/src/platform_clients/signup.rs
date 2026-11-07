//! The sign-up link (docs/blaqks-one-console.md §9 and §11): when the verified public
//! sign-up creates a company, the sign-up module calls `link_signup` inside its own
//! transaction. Every live client not yet linked whose email matches (case-insensitively)
//! is linked to the new company and moves to Signed up (a Customer stays a Customer), with
//! `stage` and `linked` timeline entries and their platform events.
use super::{events, model, timeline};
use crate::error::ApiResult;
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

const LINKED: &str = "Signed up and linked to their new company.";

#[derive(FromRow)]
struct Linked {
    id: Uuid,
    before: String,
    stage: String,
}

pub async fn link_signup(
    tx: &mut Transaction<'_, Postgres>,
    email: &str,
    workspace: &str,
) -> ApiResult<()> {
    let linked = sqlx::query_as::<_, Linked>(
        "WITH found AS (SELECT id,stage FROM platform_clients.crm_platform_clients \
         WHERE lower(email)=lower(trim($1)) AND archived_at IS NULL \
         AND linked_workspace_id IS NULL FOR UPDATE) \
         UPDATE platform_clients.crm_platform_clients c SET linked_workspace_id=$2, \
         stage=CASE WHEN found.stage='customer' THEN found.stage ELSE 'signed_up' END, \
         version=c.version+1,updated_at=now() FROM found WHERE c.id=found.id \
         RETURNING c.id,found.stage AS before,c.stage",
    )
    .bind(email)
    .bind(workspace)
    .fetch_all(&mut **tx)
    .await?;
    for client in linked {
        if client.before != client.stage {
            let change = model::stage_change(&client.before, &client.stage);
            timeline::append(tx, client.id, "stage", Some(&change), None).await?;
            events::stage_changed(tx, &client.stage, None).await?;
        }
        timeline::append(tx, client.id, "linked", Some(LINKED), None).await?;
        events::linked(tx).await?;
    }
    Ok(())
}
