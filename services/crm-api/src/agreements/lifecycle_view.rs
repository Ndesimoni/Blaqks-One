//! Shared proposal read and server-authoritative lifecycle controls.
use super::{access, model::Party, rows::AgreementRow};
use crate::{auth::session::Session, error::ApiResult};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};

pub async fn proposal(
    tx: &mut Transaction<'_, Postgres>,
    row: &AgreementRow,
) -> ApiResult<Option<Value>> {
    let Some(id) = row.proposed_revision_id else {
        return Ok(None);
    };
    Ok(sqlx::query_scalar::<_, Value>(
        "SELECT jsonb_build_object('id',id,'number',number,'authorParty',author_party,
         'digest',digest,'terms',terms,'expired',
         (terms->>'expiresAt')::timestamptz<=clock_timestamp())
         FROM agreements.crm_agreement_revisions WHERE id=$1 AND agreement_id=$2",
    )
    .bind(id)
    .bind(row.id)
    .fetch_optional(&mut **tx)
    .await?)
}

pub fn view(
    row: &AgreementRow,
    session: &Session,
    workspace: &str,
    proposal: Option<&Value>,
) -> Value {
    let party = access::party_of(row, session.user.id, workspace);
    let accepted = !row.handover() && row.state == "accepted" && party.is_some();
    let answer = accepted
        && proposal.is_some_and(|p| {
            p["expired"] == false && party.is_some_and(|party| p["authorParty"] != party.as_str())
        });
    let requested = match party {
        Some(Party::Sender) => row.cancel_sender_revision_id == row.current_revision_id,
        Some(Party::Recipient) => row.cancel_recipient_revision_id == row.current_revision_id,
        None => false,
    };
    json!({"allowed": {
        "amend":accepted && proposal.is_none_or(|p| p["expired"] == true),
        "acceptAmendment":answer,"declineAmendment":answer,
        "complete":accepted,"cancel":accepted && !requested,
        "archive":!row.handover() && session.user.role=="admin"
            && matches!(row.state.as_str(),"draft"|"sent")
    },"cancellation":{
        "sender":row.cancel_sender_revision_id.is_some() && row.cancel_sender_revision_id==row.current_revision_id,
        "recipient":row.cancel_recipient_revision_id.is_some() && row.cancel_recipient_revision_id==row.current_revision_id
    }})
}
