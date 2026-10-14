//! Idempotency: sample records already in the workspace are skipped; an ID taken by a
//! record that is not sample data refuses the whole seed.
use super::{failed, target::UNCHANGED, Outcome};
use crate::{imports::model::ImportRecords, records::validation::collection_key};
use sqlx::{FromRow, Postgres, Transaction};
use std::collections::HashMap;

/// `(collection, added, already present)` in insertion order.
pub type Counts = Vec<(&'static str, usize, usize)>;

/// `(collection, record ID)` → whether that existing row is marked as sample data.
pub type Present = HashMap<(String, String), bool>;

#[derive(FromRow)]
struct Row {
    collection: String,
    legacy_id: String,
    sample: bool,
}

pub async fn split(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    records: ImportRecords,
) -> Outcome<(ImportRecords, Counts)> {
    let mut ids = Vec::new();
    for (collection, rows) in records.collections() {
        let key = collection_key(collection).map_err(failed)?;
        ids.extend(
            rows.iter()
                .filter_map(|row| row[key].as_str().map(str::to_owned)),
        );
    }
    let rows = sqlx::query_as::<_, Row>(
        "SELECT r.collection,r.legacy_id,EXISTS(SELECT 1 FROM crm_sample_records m \
         WHERE m.record_id=r.id) AS sample FROM crm_records r \
         WHERE r.workspace_id=$1 AND r.legacy_id=ANY($2)",
    )
    .bind(workspace)
    .bind(&ids)
    .fetch_all(&mut **tx)
    .await
    .map_err(failed)?;
    let present = rows
        .into_iter()
        .map(|row| ((row.collection, row.legacy_id), row.sample))
        .collect();
    plan(records, &present)
}

pub fn plan(records: ImportRecords, present: &Present) -> Outcome<(ImportRecords, Counts)> {
    let mut missing = ImportRecords::default();
    let mut counts = Counts::new();
    for (collection, rows) in records.collections() {
        let key = collection_key(collection).map_err(failed)?;
        let (mut added, mut skipped) = (0, 0);
        for row in rows {
            let id = row[key].as_str().unwrap_or_default().to_owned();
            match present.get(&(collection.to_owned(), id.clone())) {
                Some(true) => skipped += 1,
                Some(false) => {
                    return Err(format!(
                        "{collection} {id} already exists in this workspace and is not sample \
                         data. Rename or remove it, then seed again.{UNCHANGED}"
                    ))
                }
                None => {
                    missing.push(collection, row.clone());
                    added += 1;
                }
            }
        }
        counts.push((collection, added, skipped));
    }
    Ok((missing, counts))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sample::{data, dates::Calendar};

    fn key(collection: &str, id: &str) -> (String, String) {
        (collection.to_owned(), id.to_owned())
    }

    #[test]
    fn skips_marked_rows_and_refuses_ids_taken_by_other_records() {
        let records = || data::records(&Calendar { today: 0 });
        let (missing, counts) = plan(records(), &Present::new()).unwrap();
        assert_eq!(counts.iter().map(|count| count.1).sum::<usize>(), 52);
        assert_eq!(missing.rows("Clients").len(), 10);
        let present = Present::from([(key("Clients", "CL-S01"), true)]);
        let (missing, counts) = plan(records(), &present).unwrap();
        assert_eq!(missing.rows("Clients").len(), 9);
        assert_eq!(counts[1], ("Clients", 9, 1));
        let taken = Present::from([(key("Properties", "PR-S04"), false)]);
        let Err(error) = plan(records(), &taken) else {
            panic!("an ID taken by another record must refuse the seed");
        };
        assert!(
            error.starts_with("Properties PR-S04 already exists") && error.ends_with(UNCHANGED)
        );
    }
}
