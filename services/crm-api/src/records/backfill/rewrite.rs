//! The record's media fields as they will read after the move, built before anything is
//! reserved or stored (security review L2): each moving entry gets its file ID now, and the
//! result must pass the validation a member's save uses, or the record is left alone.
use super::{
    inline::stored_entry,
    plan::{Plan, PHOTOS},
    store::Current,
};
use crate::records::validation;
use serde_json::{Map, Value};
use uuid::Uuid;

pub struct Rewrite {
    /// Only the changed fields, merged into the payload by the commit.
    pub fields: Value,
    /// The file ID of each move, in plan order.
    pub ids: Vec<Uuid>,
}

/// `None` when the rewritten fields would not pass records validation.
pub fn rewrite(record: &Current, plan: &Plan) -> Option<Rewrite> {
    let mut fields = Map::new();
    let mut ids = Vec::with_capacity(plan.moves.len());
    for item in &plan.moves {
        let id = Uuid::new_v4();
        let file = &item.file;
        let entry = stored_entry(
            &file.name,
            id,
            file.kind.content_type(),
            item.added.as_deref(),
        );
        let assets = fields
            .entry(item.field)
            .or_insert_with(|| original(record, item.field));
        *assets.as_array_mut()?.get_mut(item.index)? = entry;
        ids.push(id);
    }
    let fields = Value::Object(fields);
    validation::media::validate(&fields).ok()?;
    Some(Rewrite { fields, ids })
}

/// The field as read, copied once when its first entry moves.
fn original(record: &Current, field: &str) -> Value {
    let value = if field == PHOTOS {
        &record.photos
    } else {
        &record.plans
    };
    value.clone().unwrap_or(Value::Null)
}

#[cfg(test)]
#[path = "rewrite_tests.rs"]
mod tests;
