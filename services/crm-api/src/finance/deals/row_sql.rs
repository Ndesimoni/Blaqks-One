//! The deal columns and the finance-predicate query behind every deal read.
use crate::records::visibility::{finance_predicate, FinanceTable};

const COLUMNS: &str = "d.id,d.version,d.legacy_id,d.assignee_id,a.name AS assignee_name, \
    COALESCE(a.role='staff',false) AS assignee_staff,d.client_ref,d.property_ref,d.deal_type, \
    d.stage,d.agreed_value_fils,d.fee_basis,d.fee_rate_bp,d.fixed_fee_fils,d.partner_share_bp, \
    d.partner_name,d.second_agent_id,s.name AS second_agent_name,d.second_agent_share_bp, \
    d.second_agent_kind,d.override_agent_share_bp,d.override_reason,d.earned_on::text AS earned_on, \
    d.details,((d.created_at AT TIME ZONE 'Asia/Dubai')::date)::text AS created_on, \
    EXISTS(SELECT 1 FROM crm_deal_snapshots x WHERE x.deal_id=d.id) AS ever_earned, \
    crm_deal_approved_fils(d.id) AS approved_fils, \
    EXISTS(SELECT 1 FROM crm_finance_events e WHERE e.entity='deal' AND e.entity_id=d.id \
    AND e.action='assigned' AND (e.actor_id=$2 OR e.changes->'requestedBy'->>1=$2::text) \
    AND e.created_at > COALESCE((SELECT max(m.created_at) FROM crm_finance_events m \
    WHERE m.entity='deal' AND m.entity_id=d.id AND m.action IN ('earned','unearned')), \
    '-infinity'::timestamptz)) AS reassigned_by_actor, \
    (SELECT h.id FROM crm_deal_handovers h WHERE h.deal_id=d.id AND h.status='pending') \
    AS pending_handover";

/// `$1` workspace, `$2` the acting user, `$3` the predicate caller (NULL = team view),
/// `$4` an optional holder filter, `$5` an optional deal ID.
pub fn select(tail: &str) -> String {
    format!(
        "SELECT {COLUMNS} FROM crm_deals d LEFT JOIN crm_users a ON a.id=d.assignee_id \
         LEFT JOIN crm_users s ON s.id=d.second_agent_id WHERE d.workspace_id=$1 AND {} \
         AND ($4::uuid IS NULL OR d.assignee_id=$4) AND ($5::uuid IS NULL OR d.id=$5) {tail}",
        finance_predicate(FinanceTable::Deals, "d", "$1", "$3")
    )
}
