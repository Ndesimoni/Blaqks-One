use crate::{
    error::{ApiError, ApiResult},
    records::validation,
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
#[serde(deny_unknown_fields)]
pub struct ImportRecords {
    #[serde(rename = "Clients")]
    pub clients: Vec<Value>,
    #[serde(rename = "Contacts")]
    pub contacts: Vec<Value>,
    #[serde(rename = "Properties")]
    pub properties: Vec<Value>,
}

impl ImportRecords {
    pub fn collections(&self) -> [(&'static str, &[Value]); 3] {
        [
            ("Contacts", &self.contacts),
            ("Clients", &self.clients),
            ("Properties", &self.properties),
        ]
    }

    pub fn normalize(mut self) -> ApiResult<Self> {
        let total = self.clients.len() + self.contacts.len() + self.properties.len();
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
        for (collection, records) in [
            ("Clients", &mut self.clients),
            ("Contacts", &mut self.contacts),
            ("Properties", &mut self.properties),
        ] {
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
    ["Clients", "Contacts", "Properties"]
        .into_iter()
        .map(|collection| (collection.into(), 0))
        .collect()
}

pub fn conflict() -> ApiError {
    ApiError(
        axum::http::StatusCode::CONFLICT,
        "The import conflicts with existing records. No records were changed.",
        "import_conflict",
    )
}
