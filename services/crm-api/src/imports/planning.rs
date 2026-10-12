use super::{
    model::{conflict, zero_counts, Counts, ImportRecords},
    snapshot::TargetRow,
};
use crate::{
    error::{ApiError, ApiResult},
    records::{collections::find, validation::collection_key},
};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

pub struct Plan {
    pub records: ImportRecords,
    pub counts: Counts,
    pub skipped: Counts,
}

pub fn plan(source: ImportRecords, target: &[TargetRow]) -> ApiResult<Plan> {
    let existing: HashMap<(&str, &str), &Value> = target
        .iter()
        .map(|row| {
            (
                (row.collection.as_str(), row.legacy_id.as_str()),
                &row.payload,
            )
        })
        .collect();
    ensure_links(&source, target)?;
    let mut planned = ImportRecords::default();
    let mut counts = zero_counts();
    let mut skipped = zero_counts();
    for (collection, rows) in source.collections() {
        let key = collection_key(collection)?;
        for row in rows {
            let id = row[key]
                .as_str()
                .ok_or_else(|| ApiError::invalid("Missing source record ID."))?;
            match existing.get(&(collection, id)) {
                Some(payload) if **payload == *row => *skipped.get_mut(collection).unwrap() += 1,
                Some(_) => return Err(conflict()),
                None => {
                    planned.push(collection, row.clone());
                    *counts.get_mut(collection).unwrap() += 1;
                }
            }
        }
    }
    Ok(Plan {
        records: planned,
        counts,
        skipped,
    })
}

/// Every linked ID must exist in the target workspace or arrive in the same import.
fn ensure_links(source: &ImportRecords, target: &[TargetRow]) -> ApiResult<()> {
    let mut known: HashSet<(&str, &str)> = target
        .iter()
        .map(|row| (row.collection.as_str(), row.legacy_id.as_str()))
        .collect();
    for (collection, rows) in source.collections() {
        let key = collection_key(collection)?;
        known.extend(
            rows.iter()
                .filter_map(|row| Some((collection, row[key].as_str()?))),
        );
    }
    for (collection, rows) in source.collections() {
        for link in find(collection)?.links {
            let missing = rows.iter().any(|row| {
                row.get(link.field)
                    .and_then(Value::as_str)
                    .is_some_and(|id| !id.is_empty() && !known.contains(&(link.target, id)))
            });
            if missing {
                return Err(ApiError::invalid(
                    "A record links to a client, contact or property missing from this workspace.",
                ));
            }
        }
    }
    Ok(())
}
