use crate::{
    error::{ApiError, ApiResult},
    records::{
        collections::{self, COLLECTIONS},
        validation,
    },
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{BTreeMap, HashSet},
    mem,
};

pub type Counts = BTreeMap<String, usize>;

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct PreviewRequest {
    pub source_workspace_id: String,
    pub records: ImportRecords,
}

#[derive(Default, Deserialize, Serialize)]
#[serde(transparent)]
pub struct ImportRecords(pub BTreeMap<String, Vec<Value>>);

impl ImportRecords {
    /// Collections in insertion order, including empty ones.
    pub fn collections(&self) -> Vec<(&'static str, &[Value])> {
        COLLECTIONS
            .iter()
            .map(|collection| (collection.name, self.rows(collection.name)))
            .collect()
    }

    pub fn rows(&self, collection: &str) -> &[Value] {
        self.0.get(collection).map(Vec::as_slice).unwrap_or(&[])
    }

    pub fn push(&mut self, collection: &str, row: Value) {
        self.0.entry(collection.into()).or_default().push(row);
    }

    pub fn normalize(mut self) -> ApiResult<Self> {
        if self.0.len() != COLLECTIONS.len()
            || self.0.keys().any(|name| collections::find(name).is_err())
        {
            return Err(ApiError::invalid(
                "Provide every supported record collection and no others.",
            ));
        }
        let total: usize = self.0.values().map(Vec::len).sum();
        if total > 1000
            || serde_json::to_vec(&self)
                .map_err(|_| ApiError::invalid("Invalid import."))?
                .len()
                > validation::MAX_RECORD_BYTES
        {
            return Err(ApiError::invalid(
                "Imports allow at most 1000 records and 12 MiB.",
            ));
        }
        for (collection, records) in &mut self.0 {
            let mut ids = HashSet::new();
            for record in records {
                super::credentials::reject(record)?;
                let validated = validation::validate(collection, mem::take(record))?;
                if !ids.insert(validated.legacy_id) {
                    return Err(ApiError::invalid(
                        "The source contains duplicate record IDs.",
                    ));
                }
                *record = validated.payload;
            }
        }
        Ok(self)
    }
}

pub fn zero_counts() -> Counts {
    COLLECTIONS
        .iter()
        .map(|collection| (collection.name.into(), 0))
        .collect()
}

pub fn conflict() -> ApiError {
    ApiError(
        axum::http::StatusCode::CONFLICT,
        "The import conflicts with existing records. No records were changed.",
        "import_conflict",
    )
}
