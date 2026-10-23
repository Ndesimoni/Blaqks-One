//! Builds what a listing share freezes (docs/record-sharing.md R2): the outside facts, the
//! exact location only when switched on (otherwise its salted fingerprint), each stored
//! photo and floor plan under a neutral name with its source's SHA-256, and the digest over
//! all of it. What the review warns about is in `review.rs`.
use super::{
    digest,
    review::{self, files},
    snapshot_store,
};
use crate::{
    error::ApiResult,
    media::copies::{self, Source},
    records::outside_facts::Outside,
};
use serde_json::{Map, Value};
use sqlx::{Postgres, Transaction};
use std::collections::HashMap;
use uuid::Uuid;

const LOCATION: [&str; 3] = ["unitReference", "address", "mapLink"];

/// One photo or floor plan to copy, with its thumbnail when it has one.
pub struct File {
    pub kind: &'static str,
    pub name: String,
    pub source: Source,
    pub thumb: Option<Source>,
}

pub struct Draft {
    pub facts: Map<String, Value>,
    pub files: Vec<File>,
    pub exact: bool,
    pub salt: Option<String>,
    pub location: Option<String>,
    pub digest: String,
    /// What the sender reviewed (`previewDigest`): unsalted, shown to the sender's side only.
    pub review: String,
    pub warnings: Vec<&'static str>,
}

impl Draft {
    /// The entries the digest covers, in order.
    pub fn entries(&self) -> Vec<Value> {
        let entry = |file: &File| digest::file_entry(file.kind, &file.name, &file.source.sha256);
        self.files.iter().map(entry).collect()
    }

    /// Every distinct source file to copy, with its neutral name.
    pub fn plan(&self) -> Vec<(Source, String)> {
        let mut plan: Vec<(Source, String)> = Vec::new();
        for file in &self.files {
            let thumb = file
                .thumb
                .iter()
                .map(|thumb| (thumb, format!("{} preview", file.name)));
            for (source, name) in std::iter::once((&file.source, file.name.clone())).chain(thumb) {
                if plan.iter().all(|(planned, _)| planned.id != source.id) {
                    plan.push((source.clone(), name));
                }
            }
        }
        plan
    }
}

/// The draft snapshot of `record` as `outside` reads it now.
pub async fn draft(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    record: Uuid,
    outside: Outside,
    exact: bool,
) -> ApiResult<Draft> {
    let all = outside.photos.iter().chain(&outside.plans);
    let ids: Vec<Uuid> = all
        .flat_map(|asset| std::iter::once(asset.file).chain(asset.thumb))
        .collect();
    let found = copies::sources(tx, workspace, record, &ids).await?;
    let found: HashMap<Uuid, Source> = found
        .into_iter()
        .map(|source| (source.id, source))
        .collect();
    let (mut kept, missing) = files("photo", &outside.photos, &found);
    let (plans, missing_plans) = files("floorPlan", &outside.plans, &found);
    kept.extend(plans);
    let mut facts = outside.facts;
    let (salt, location) = if exact {
        facts.extend(outside.location.clone());
        (None, None)
    } else {
        let salt = snapshot_store::salt_for(tx, workspace, record)
            .await?
            .unwrap_or_else(digest::salt);
        let value = |key: &str| {
            outside
                .location
                .get(key)
                .and_then(Value::as_str)
                .unwrap_or("")
        };
        let fingerprint = digest::location(&salt, LOCATION.map(value));
        (Some(salt), Some(fingerprint))
    };
    let missing = missing + missing_plans;
    let warnings = review::warnings(&facts, (outside.inline, outside.over, missing));
    let mut draft = Draft {
        facts,
        files: kept,
        exact,
        salt,
        location,
        digest: String::new(),
        review: String::new(),
        warnings,
    };
    let entries = draft.entries();
    draft.review = digest::review(&draft.facts, &outside.location, &entries, exact);
    draft.digest = digest::snapshot(&draft.facts, &entries, exact, draft.location.as_deref());
    Ok(draft)
}
