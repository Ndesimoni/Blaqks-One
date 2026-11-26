//! Server-issued workbook-style record IDs (L1), for example `CL-045`.
use crate::error::{ApiError, ApiResult};
use sqlx::{Postgres, Transaction};

/// The largest number an issued ID may carry; longer numbers are never parsed.
pub const MAX_NUMBER: i64 = 999_999_999;

pub fn prefix(collection: &str) -> ApiResult<&'static str> {
    Ok(match collection {
        "Clients" => "CL",
        "Contacts" => "CT",
        "Properties" => "PR",
        "Follow-ups" => "FU",
        "Viewings" => "VW",
        "Shortlist" => "MT",
        "Interaction log" => "LG",
        "Client care" => "CA",
        _ => return Err(ApiError::invalid("Unsupported record collection.")),
    })
}

/// Pattern whose single group is the 1–9 digit number of an issued-style ID.
pub fn pattern(collection: &str) -> ApiResult<String> {
    Ok(format!("^{}-([0-9]{{1,9}})$", prefix(collection)?))
}

pub fn format(collection: &str, number: i64) -> ApiResult<String> {
    numbered(prefix(collection)?, number)
}

/// `PREFIX-NNN`, or the exhaustion conflict outside `1..=MAX_NUMBER` (also used by
/// `finance::ids`).
pub fn numbered(prefix: &str, number: i64) -> ApiResult<String> {
    if !(1..=MAX_NUMBER).contains(&number) {
        return Err(ApiError::conflict(
            "No record IDs are left for this collection. Ask your Admin.",
        ));
    }
    Ok(format!("{prefix}-{number:03}"))
}

/// Issues the next ID for `collection`. Call under the workspace lock: the maximum is
/// taken across every row of the workspace, including rows hidden from the caller,
/// and IDs that do not parse are ignored.
pub async fn issue(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    collection: &str,
) -> ApiResult<String> {
    let next: i64 = sqlx::query_scalar(
        "SELECT COALESCE(max(substring(legacy_id FROM $3)::bigint),0)+1 FROM crm_records \
         WHERE workspace_id=$1 AND collection=$2",
    )
    .bind(workspace)
    .bind(collection)
    .bind(pattern(collection)?)
    .fetch_one(&mut **transaction)
    .await?;
    format(collection, next)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn issued_ids_are_padded_prefixed_and_bounded() {
        assert_eq!(format("Clients", 45).unwrap(), "CL-045");
        assert_eq!(format("Shortlist", 1).unwrap(), "MT-001");
        assert_eq!(format("Client care", 12345).unwrap(), "CA-12345");
        assert_eq!(format("Properties", MAX_NUMBER).unwrap(), "PR-999999999");
        let overflow = format("Properties", MAX_NUMBER + 1).unwrap_err();
        assert_eq!((overflow.0.as_u16(), overflow.2), (409, "conflict"));
        assert_eq!(pattern("Viewings").unwrap(), "^VW-([0-9]{1,9})$");
        assert!(prefix("Deals").is_err());
        let prefixes: std::collections::HashSet<_> = super::super::collections::COLLECTIONS
            .iter()
            .map(|collection| prefix(collection.name).unwrap())
            .collect();
        assert_eq!(prefixes.len(), 8);
    }
}
