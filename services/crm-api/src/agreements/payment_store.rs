//! Immutable ledger reads and amendment solvency checks, called under the agreement lock.
use super::{payment_model, rows::AgreementRow, store};
use crate::error::{ApiError, ApiResult};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn entries(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> ApiResult<Vec<Value>> {
    Ok(sqlx::query_scalar(
        "SELECT jsonb_build_object('id',id,'action',action,'referenceId',reference_id,
         'amountFils',amount_fils,'paidOn',paid_on::text,'party',party,'actorId',actor_id,
         'createdAt',to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"'))
         FROM agreements.crm_agreement_payments WHERE agreement_id=$1 ORDER BY created_at,id",
    )
    .bind(id)
    .fetch_all(&mut **tx)
    .await?)
}
pub async fn totals(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> ApiResult<(i64, i64)> {
    Ok(sqlx::query_as(
        "SELECT COALESCE(sum(p.amount_fils) FILTER(WHERE x.action IS DISTINCT FROM 'withdrawn'),0)::bigint,
         COALESCE(sum(p.amount_fils) FILTER(WHERE x.action='confirmed'),0)::bigint
         FROM agreements.crm_agreement_payments p LEFT JOIN agreements.crm_agreement_payments x
         ON x.reference_id=p.id WHERE p.agreement_id=$1 AND p.action='paid'")
        .bind(id).fetch_one(&mut **tx).await?)
}
pub async fn summary(tx: &mut Transaction<'_, Postgres>, row: &AgreementRow) -> ApiResult<Value> {
    let current = store::current(tx, row.id).await?;
    let due = payment_model::due(&row.kind, &current.terms);
    if row.handover() || due.is_err() {
        return Ok(json!({"available":false}));
    }
    let (payer, due) = due?;
    let (paid, confirmed) = totals(tx, row.id).await?;
    Ok(
        json!({"available":true,"payer":payer.as_str(),"dueFils":due,"paidFils":paid,
        "confirmedFils":confirmed,"outstandingFils":due-paid}),
    )
}
pub async fn ensure_amendment(
    tx: &mut Transaction<'_, Postgres>,
    row: &AgreementRow,
    terms: &Value,
) -> ApiResult<()> {
    let (paid, _) = totals(tx, row.id).await?;
    if paid == 0 {
        return Ok(());
    }
    let old = store::current(tx, row.id).await?;
    let (payer, _) = payment_model::due(&row.kind, &old.terms)?;
    let (new_payer, due) = payment_model::due(&row.kind, terms)?;
    if payer != new_payer || due < paid {
        return Err(ApiError::conflict(
            "The amendment must preserve the payer and cover all live payments.",
        ));
    }
    Ok(())
}
