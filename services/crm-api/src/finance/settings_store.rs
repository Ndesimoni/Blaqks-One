//! Settings persistence: one versioned row per workspace, written under the workspace
//! lock with a finance event in the same transaction.
use super::{
    access,
    events::{self, Action, Changes, Entity},
    settings::{SettingsInput, SettingsRow, STALE},
};
use crate::error::{ApiError, ApiResult};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

const COLUMNS: &str = "id,version,agent_share_bp,second_agent_source,max_referral_share_bp, \
    vat_registered,vat_rate_bp,trn";

pub async fn load(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    for_update: bool,
) -> ApiResult<Option<SettingsRow>> {
    let lock = if for_update { " FOR UPDATE" } else { "" };
    let sql = format!("SELECT {COLUMNS} FROM crm_finance_settings WHERE workspace_id=$1{lock}");
    Ok(sqlx::query_as::<_, SettingsRow>(&sql)
        .bind(workspace)
        .fetch_optional(&mut **transaction)
        .await?)
}

fn changes(before: Option<&SettingsRow>, after: &SettingsInput) -> Changes {
    let old = |pick: fn(&SettingsRow) -> serde_json::Value| before.map(pick);
    Changes::default()
        .pair(
            "agentShareBp",
            old(|s| s.agent_share_bp.into()),
            after.agent_share_bp,
        )
        .pair(
            "secondAgentSource",
            old(|s| s.second_agent_source.clone().into()),
            after.second_agent_source,
        )
        .pair(
            "maxReferralShareBp",
            old(|s| s.max_referral_share_bp.into()),
            after.max_referral_share_bp,
        )
        .pair(
            "vatRegistered",
            old(|s| s.vat_registered.into()),
            after.vat_registered,
        )
        .text("trn", before.and_then(|s| s.trn.clone()) != after.trn)
}

pub async fn save(
    pool: &PgPool,
    actor: Uuid,
    workspace: &str,
    input: SettingsInput,
) -> ApiResult<SettingsRow> {
    let mut transaction = pool.begin().await?;
    access::lock_manager(&mut transaction, workspace, actor).await?;
    let current = load(&mut transaction, workspace, true).await?;
    let (action, id) = match (&current, input.version) {
        (None, None) => (Action::Created, Uuid::new_v4()),
        (Some(row), Some(version)) if row.version == version => (Action::Updated, row.id),
        _ => return Err(ApiError::stale(STALE)),
    };
    let changes = changes(current.as_ref(), &input);
    if let (Some(row), true) = (&current, changes.is_empty()) {
        return Ok(row.clone()); // nothing changed: no new version or event
    }
    sqlx::query(
        "INSERT INTO crm_finance_settings (workspace_id,id,agent_share_bp,second_agent_source, \
         max_referral_share_bp,vat_registered,trn,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) \
         ON CONFLICT (workspace_id) DO UPDATE SET agent_share_bp=EXCLUDED.agent_share_bp, \
         second_agent_source=EXCLUDED.second_agent_source, \
         max_referral_share_bp=EXCLUDED.max_referral_share_bp, \
         vat_registered=EXCLUDED.vat_registered,trn=EXCLUDED.trn, \
         updated_by=EXCLUDED.updated_by,updated_at=now(), \
         version=crm_finance_settings.version+1",
    )
    .bind(workspace)
    .bind(id)
    .bind(input.agent_share_bp)
    .bind(input.second_agent_source)
    .bind(input.max_referral_share_bp)
    .bind(input.vat_registered)
    .bind(&input.trn)
    .bind(actor)
    .execute(&mut *transaction)
    .await?;
    events::append(
        &mut transaction,
        workspace,
        Entity::Settings,
        id,
        action,
        actor,
        changes,
        None,
    )
    .await?;
    let saved = load(&mut transaction, workspace, false).await?;
    transaction.commit().await?;
    saved.ok_or(ApiError::stale(STALE))
}
