//! Checks `clear-sample` runs under the workspace lock before deleting anything.
use super::{failed, target::UNCHANGED, Outcome};
use sqlx::{FromRow, Postgres, Transaction};

#[derive(FromRow)]
pub struct Found {
    pub collection: String,
    pub legacy_id: String,
}

/// Records people created that link to a sample client, property or contact
/// (including referrals). Deleting the sample record would break them.
pub const LINKED: &str = "SELECT r.collection,r.legacy_id FROM crm_records r \
     WHERE r.workspace_id=$1 \
     AND NOT EXISTS (SELECT 1 FROM crm_sample_records m WHERE m.record_id=r.id) \
     AND EXISTS (SELECT 1 FROM crm_records s JOIN crm_sample_records m ON m.record_id=s.id \
     WHERE s.workspace_id=$1 AND ((s.collection='Contacts' AND s.legacy_id=r.contact_id) \
     OR (s.collection='Clients' AND s.legacy_id IN (r.client_ref,r.referral_ref)) \
     OR (s.collection='Properties' AND s.legacy_id=r.property_ref))) \
     ORDER BY r.collection,r.legacy_id";

/// Sample records changed in the app since seeding: a newer version, a hand-off note,
/// or assignment history or activity that the sample command did not write.
pub const EDITED: &str = "SELECT r.collection,r.legacy_id FROM crm_records r \
     JOIN crm_sample_records m ON m.record_id=r.id \
     WHERE m.workspace_id=$1 AND r.workspace_id=$1 AND (r.version>1 \
     OR EXISTS (SELECT 1 FROM crm_assignment_notes n WHERE n.record_id=r.id) \
     OR EXISTS (SELECT 1 FROM crm_assignments h WHERE h.record_id=r.id AND h.source<>'sample') \
     OR EXISTS (SELECT 1 FROM crm_activity a WHERE a.record_id=r.id AND a.source<>'sample')) \
     ORDER BY r.collection,r.legacy_id";

pub async fn find(
    tx: &mut Transaction<'_, Postgres>,
    sql: &str,
    workspace: &str,
) -> Outcome<Vec<Found>> {
    sqlx::query_as::<_, Found>(sql)
        .bind(workspace)
        .fetch_all(&mut **tx)
        .await
        .map_err(failed)
}

/// Up to ten `Collection ID` entries, then how many more.
pub fn list(found: &[Found]) -> String {
    let listed: Vec<String> = found
        .iter()
        .take(10)
        .map(|row| format!("{} {}", row.collection, row.legacy_id))
        .collect();
    match found.len() - listed.len() {
        0 => listed.join(", "),
        more => format!("{} and {more} more", listed.join(", ")),
    }
}

pub fn linked_message(found: &[Found]) -> String {
    format!(
        "{} record(s) that people added link to sample records: {}. Remove those links \
         or delete those records, then clear again.{UNCHANGED}",
        found.len(),
        list(found)
    )
}

pub fn edited_message(found: &[Found]) -> String {
    format!(
        "{} sample record(s) were changed in the app: {}. Pass --include-edited to remove \
         them as well.{UNCHANGED}",
        found.len(),
        list(found)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn found(count: usize) -> Vec<Found> {
        (1..=count)
            .map(|n| Found {
                collection: "Clients".into(),
                legacy_id: format!("CL-S{n:02}"),
            })
            .collect()
    }

    #[test]
    fn messages_list_at_most_ten_records_and_change_nothing() {
        assert_eq!(list(&found(2)), "Clients CL-S01, Clients CL-S02");
        assert!(list(&found(12)).ends_with("Clients CL-S10 and 2 more"));
        let edited = edited_message(&found(1));
        assert!(edited.contains("--include-edited") && edited.ends_with(UNCHANGED));
        assert!(linked_message(&found(1)).starts_with("1 record(s) that people added"));
    }
}
