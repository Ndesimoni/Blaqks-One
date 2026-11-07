//! What the backfill does with one property record's media fields: which inline entries move
//! (bytes checked and cleaned like uploads) and which stay inline, with the reason. Pure, so
//! the dry run and `--apply` decide identically.
use super::inline::{classify, decode, Entry, Reason};
use crate::media::{
    backfill::{prepare, Prepared, Refusal},
    sniff::Kind,
};
use serde_json::Value;

pub const PHOTOS: &str = "media_photos";
pub const PLANS: &str = "media_floorplans";

/// One inline entry that moves: where it is, its `added` text and the cleaned file.
pub struct Move {
    pub field: &'static str,
    pub index: usize,
    pub added: Option<String>,
    pub file: Prepared,
}

#[derive(Default)]
pub struct Plan {
    pub moves: Vec<Move>,
    pub left: Vec<(&'static str, usize, Reason)>,
}

impl Plan {
    pub fn bytes(&self) -> i64 {
        self.moves
            .iter()
            .map(|item| item.file.bytes.len() as i64)
            .sum()
    }
}

/// Plans the record's photos and floor plans in order. `headroom` is the company's storage
/// still free; each move takes its size from it, and an entry that no longer fits stays.
pub fn plan(fields: &[(&'static str, Option<Value>)], headroom: &mut i64) -> Plan {
    let mut plan = Plan::default();
    for (field, value) in fields {
        let Some(assets) = value.as_ref().and_then(Value::as_array) else {
            continue;
        };
        for (index, asset) in assets.iter().enumerate() {
            match prepared(field, asset) {
                None => {}
                Some(Err(reason)) => plan.left.push((field, index, reason)),
                Some(Ok((file, added))) => {
                    let size = file.bytes.len() as i64;
                    if size > *headroom {
                        plan.left.push((field, index, Reason::OverQuota));
                        continue;
                    }
                    *headroom -= size;
                    plan.moves.push(Move {
                        field,
                        index,
                        added,
                        file,
                    });
                }
            }
        }
    }
    plan
}

type Ready = (Prepared, Option<String>);

/// `None` for entries that are not inline; otherwise the cleaned file or why it stays.
fn prepared(field: &str, asset: &Value) -> Option<Result<Ready, Reason>> {
    let inline = match classify(asset) {
        Entry::Keep => return None,
        Entry::Left(reason) => return Some(Err(reason)),
        Entry::Inline(inline) => inline,
    };
    let ready = decode(inline.encoded).and_then(|bytes| {
        let file = prepare(inline.name, &bytes).map_err(|refusal| match refusal {
            Refusal::Unsupported => Reason::Unsupported,
            Refusal::TooLarge => Reason::TooLarge,
            Refusal::Unreadable => Reason::Unreadable,
        })?;
        // Photos are images; only floor plans may be PDFs (records validation).
        if field == PHOTOS && file.kind == Kind::Pdf {
            return Err(Reason::Unsupported);
        }
        Ok((file, inline.added.map(str::to_owned)))
    });
    Some(ready)
}

#[cfg(test)]
#[path = "plan_tests.rs"]
mod tests;
