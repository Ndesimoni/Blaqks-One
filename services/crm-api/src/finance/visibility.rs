//! Which finance rows a caller may see (finance-design §5.2). Finance owns this predicate;
//! records reach deals only through `finance::deals::visible` (service-boundaries C6).

/// Finance tables (finance-design §5.2), a closed set: callers never pass table names.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FinanceTable {
    Deals,
    Payments,
    Expenses,
}

/// SQL condition that the finance row aliased `alias` is visible; bind the caller's UUID
/// to `caller`, or NULL for team finance. Own view: deals they hold, payments on those
/// deals and expenses they incurred. Commission lines are never a handle to a deal.
pub fn finance_predicate(
    table: FinanceTable,
    alias: &str,
    workspace: &str,
    caller: &str,
) -> String {
    let own = match table {
        FinanceTable::Deals => format!("{alias}.assignee_id={caller}"),
        FinanceTable::Payments => format!(
            "{alias}.deal_ref IN (SELECT held.legacy_id FROM crm_deals held \
             WHERE held.workspace_id={workspace} AND held.assignee_id={caller})"
        ),
        FinanceTable::Expenses => format!("{alias}.incurred_by={caller}"),
    };
    format!("({caller}::uuid IS NULL OR {own})")
}

/// SQL scalar for the activity feed: the legacy ID of the finance row that the
/// `crm_activity` row aliased `activity` names, when it still exists in `workspace` and is
/// visible to `caller` (NULL for team finance); otherwise NULL. Finance keeps its tables.
pub fn activity_legacy_id(activity: &str, workspace: &str, caller: &str) -> String {
    let lookup = |table: FinanceTable, name: &str, alias: &str| {
        format!(
            "(SELECT {alias}.legacy_id FROM {name} {alias} WHERE {alias}.id={activity}.record_id \
             AND {alias}.workspace_id={workspace} AND {})",
            finance_predicate(table, alias, workspace, caller)
        )
    };
    format!(
        "CASE {activity}.collection WHEN 'Deals' THEN {} WHEN 'Payments' THEN {} \
         WHEN 'Expenses' THEN {} END",
        lookup(FinanceTable::Deals, "crm_deals", "fd"),
        lookup(FinanceTable::Payments, "crm_payments", "fp"),
        lookup(FinanceTable::Expenses, "crm_expenses", "fe"),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_own_view_follows_holder_payment_deal_and_incurrer() {
        let deals = finance_predicate(FinanceTable::Deals, "d", "$1", "$2");
        assert_eq!(deals, "($2::uuid IS NULL OR d.assignee_id=$2)");
        let payments = finance_predicate(FinanceTable::Payments, "p", "$1", "$2");
        assert!(payments.contains("held.workspace_id=$1 AND held.assignee_id=$2"));
        let expenses = finance_predicate(FinanceTable::Expenses, "e", "$1", "$3");
        assert_eq!(expenses, "($3::uuid IS NULL OR e.incurred_by=$3)");
        let feed = activity_legacy_id("a", "$1", "$9");
        assert!(feed.contains("fd.id=a.record_id AND fd.workspace_id=$1"));
        assert!(feed.contains("($9::uuid IS NULL OR fe.incurred_by=$9)"));
    }
}
