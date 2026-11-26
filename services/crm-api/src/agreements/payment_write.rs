//! Named payer records or withdraws; named payee confirms. No Admin substitution.
use super::{access, command::Command, ledger, payment_model, payment_store, store, wire};
use crate::error::{ApiError, ApiResult};
use axum::Json;
use serde_json::{json, Value};
use time::{Date, OffsetDateTime, UtcOffset};
use uuid::Uuid;

pub(super) async fn record(
    mut cmd: Command,
    action: &str,
    reference: Option<Uuid>,
) -> ApiResult<Json<Value>> {
    if !matches!(cmd.row.state.as_str(), "accepted" | "completed") {
        return Err(ApiError::conflict(
            "Payments require an accepted or completed agreement.",
        ));
    }
    let current = store::current(&mut cmd.tx, cmd.row.id).await?;
    let (payer, due) = payment_model::due(&cmd.row.kind, &current.terms)?;
    access::require(
        cmd.party,
        if action == "confirmed" {
            payer.other()
        } else {
            payer
        },
    )?;
    let (amount, date) = if let Some(reference) = reference {
        let original: Option<(i64, String)> = sqlx::query_as(
            "SELECT amount_fils,paid_on::text FROM agreements.crm_agreement_payments p
             WHERE id=$1 AND agreement_id=$2 AND action='paid' AND NOT EXISTS
             (SELECT 1 FROM agreements.crm_agreement_payments x WHERE x.reference_id=p.id)",
        )
        .bind(reference)
        .bind(cmd.row.id)
        .fetch_optional(&mut *cmd.tx)
        .await?;
        original.ok_or(ApiError::conflict(
            "This payment has already been answered or is unavailable.",
        ))?
    } else {
        let amount = wire::amount(&cmd.body["amountFils"])?;
        let date = wire::text(&cmd.body["paidOn"], 10)?;
        let parsed = Date::parse(&date, &time::format_description::well_known::Iso8601::DATE)
            .map_err(|_| ApiError::invalid(wire::INVALID))?;
        let today = OffsetDateTime::now_utc()
            .to_offset(UtcOffset::from_hms(4, 0, 0).map_err(|_| ApiError::invalid(wire::INVALID))?)
            .date();
        if parsed > today {
            return Err(ApiError::invalid(
                "The payment date cannot be in the future.",
            ));
        }
        let (paid, _) = payment_store::totals(&mut cmd.tx, cmd.row.id).await?;
        if i128::from(paid) + i128::from(amount) > i128::from(due) {
            return Err(ApiError::conflict("Payments cannot exceed the amount due."));
        }
        (amount, date)
    };
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO agreements.crm_agreement_payments
        (id,agreement_id,revision_id,action,reference_id,amount_fils,paid_on,party,actor_id)
        VALUES($1,$2,$3,$4,$5,$6,$7::text::date,$8,$9)",
    )
    .bind(id)
    .bind(cmd.row.id)
    .bind(current.id)
    .bind(action)
    .bind(reference)
    .bind(amount)
    .bind(date)
    .bind(cmd.party.as_str())
    .bind(cmd.actor)
    .execute(&mut *cmd.tx)
    .await?;
    let next = cmd.row.state.clone();
    let version = ledger::bump(&mut cmd.tx, cmd.row.id, cmd.row.version, &next, None, None).await?;
    ledger::event(
        &mut cmd.tx,
        cmd.row.id,
        Some(current.id),
        &format!("payment_{action}"),
        cmd.actor,
        cmd.party,
    )
    .await?;
    cmd.commit(&next, version, json!({"paymentId":id})).await
}
