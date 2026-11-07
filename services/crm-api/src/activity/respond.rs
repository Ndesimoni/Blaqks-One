//! Merges every activity source's page into one response, newest first.
use super::{cursor, window::Item};
use serde_json::{json, Value};

/// Merges every source newest first, keeps `limit` items and, when more exist, the
/// cursor of the last item kept.
pub fn respond(mut items: Vec<Item>, limit: i64) -> Value {
    items.sort_by_key(|item| std::cmp::Reverse(item.key()));
    let limit = usize::try_from(limit).unwrap_or(0);
    let next = (items.len() > limit).then(|| cursor::encode(items[limit - 1].key()));
    items.truncate(limit);
    json!({"activity": items, "nextCursor": next})
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::activity::window::Person;
    use uuid::Uuid;

    fn item(micros: i64, id: u128) -> Item {
        let actor = Person {
            id: Uuid::nil(),
            name: "Actor".into(),
        };
        let (kind, action, collection) = ("team", "invited".into(), None);
        let (at, record, member, channel, sample) = (String::new(), None, None, None, false);
        let id = Uuid::from_u128(id);
        Item {
            id,
            at,
            kind,
            action,
            collection,
            actor,
            record,
            member,
            channel,
            sample,
            micros,
        }
    }

    #[test]
    fn pages_merge_newest_first_and_break_ties_by_id() {
        let body = respond(vec![item(5, 1), item(9, 2), item(5, 3)], 2);
        let ids: Vec<&str> = body["activity"]
            .as_array()
            .unwrap()
            .iter()
            .map(|row| row["id"].as_str().unwrap())
            .collect();
        assert_eq!(
            ids,
            [
                Uuid::from_u128(2).to_string(),
                Uuid::from_u128(3).to_string()
            ]
        );
        assert_eq!(
            cursor::decode(body["nextCursor"].as_str().unwrap()),
            Some((5, Uuid::from_u128(3)))
        );
        assert!(body["activity"][0].get("micros").is_none());
        assert!(respond(vec![item(1, 1)], 2)["nextCursor"].is_null());
    }
}
