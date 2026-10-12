use super::{
    model::{conflict, zero_counts, Counts, ImportRecords},
    snapshot::TargetRow,
};
use crate::{
    error::{ApiError, ApiResult},
    records::validation::collection_key,
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
    let mut contacts: HashSet<&str> = target
        .iter()
        .filter(|row| row.collection == "Contacts")
        .map(|row| row.legacy_id.as_str())
        .collect();
    contacts.extend(
        source
            .contacts
            .iter()
            .filter_map(|row| row["contact_id"].as_str()),
    );
    for property in &source.properties {
        if property
            .get("contact_id")
            .and_then(Value::as_str)
            .is_some_and(|id| !id.trim().is_empty() && !contacts.contains(id))
        {
            return Err(ApiError::invalid(
                "A property references a contact missing from this workspace.",
            ));
        }
    }
    let mut planned = ImportRecords::default();
    let mut counts = zero_counts();
    let mut skipped = zero_counts();
    for (collection, rows) in source.collections() {
        let key = collection_key(collection)?;
        let output = match collection {
            "Clients" => &mut planned.clients,
            "Contacts" => &mut planned.contacts,
            _ => &mut planned.properties,
        };
        for row in rows {
            let id = row[key]
                .as_str()
                .ok_or_else(|| ApiError::invalid("Missing source record ID."))?;
            match existing.get(&(collection, id)) {
                Some(payload) if **payload == *row => *skipped.get_mut(collection).unwrap() += 1,
                Some(_) => return Err(conflict()),
                None => {
                    output.push(row.clone());
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
