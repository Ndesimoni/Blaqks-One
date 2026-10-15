//! Server-issued finance IDs (finance-design §6.2, §13 Info), for example `DL-007`. The
//! numbering and exhaustion rule are shared with record IDs (`records::ids::numbered`).
use crate::{error::ApiResult, records::ids::numbered};
use sqlx::{Postgres, Transaction};

/// Finance tables with server-issued IDs: a closed enum, so the table name never comes
/// from a request.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FinanceIds {
    Deals,
    Payments,
    Expenses,
}

impl FinanceIds {
    fn table(self) -> &'static str {
        match self {
            Self::Deals => "crm_deals",
            Self::Payments => "crm_payments",
            Self::Expenses => "crm_expenses",
        }
    }

    pub fn prefix(self) -> &'static str {
        match self {
            Self::Deals => "DL",
            Self::Payments => "PM",
            Self::Expenses => "EX",
        }
    }
}

/// Issues the next finance ID under the workspace lock, across every row of the table
/// in the workspace (hidden rows included), ignoring IDs that do not parse.
pub async fn issue(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    kind: FinanceIds,
) -> ApiResult<String> {
    let sql = format!(
        "SELECT COALESCE(max(substring(legacy_id FROM $2)::bigint),0)+1 FROM {} \
         WHERE workspace_id=$1",
        kind.table()
    );
    let next: i64 = sqlx::query_scalar(&sql)
        .bind(workspace)
        .bind(format!("^{}-([0-9]{{1,9}})$", kind.prefix()))
        .fetch_one(&mut **transaction)
        .await?;
    numbered(kind.prefix(), next)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finance_ids_have_their_own_prefixes() {
        let finance = [
            FinanceIds::Deals,
            FinanceIds::Payments,
            FinanceIds::Expenses,
        ];
        assert_eq!(finance.map(FinanceIds::prefix), ["DL", "PM", "EX"]);
        assert_eq!(numbered("DL", 7).unwrap(), "DL-007");
    }
}
