//! `GET /api/crm/workspaces/{ws}/activity` (docs/team-activity-design.md). Check order:
//! session (401), workspace access (one 403), permission parameters (403), syntax and
//! ranges (400), then one REPEATABLE READ READ ONLY snapshot that re-reads the live
//! member, repeats the permission checks on it and reads both owners' pages.
use super::{
    cursor, dates,
    query::Params,
    window::{Item, Window},
};
use crate::{
    auth::{profile::UserRow, session::Session},
    error::ApiResult,
    records::activity::{feed_collections, page as record_page},
    state::AppState,
    team::audit::page as team_page,
    workspaces::{ensure_access, member},
};
use axum::{
    extract::{Path, RawQuery, State},
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

/// Upper keyset bound when no cursor is given: everything before the next Dubai day.
const NEWEST: Uuid = Uuid::max();

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
    RawQuery(raw): RawQuery,
) -> ApiResult<Json<Value>> {
    ensure_access(&state, &session, &workspace).await?;
    let params = Params::parse(raw.as_deref());
    params.authorise(&session.user, &feed_collections(&session.user))?;
    let filters = params.validate(dates::today())?;
    let mut transaction = state.pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *transaction)
        .await?;
    let user = member(&mut transaction, &workspace, session.user.id).await?;
    let granted = feed_collections(&user);
    params.authorise(&user, &granted)?;
    let end = (dates::start_micros(filters.days.1 + 1), NEWEST);
    let window = Window {
        workspace,
        from_micros: dates::start_micros(filters.days.0),
        upper: filters.cursor.map_or(end, |position| position.min(end)),
        actor: own_actor(&user, filters.actor),
        action: filters.action,
        fetch: filters.limit + 1,
    };
    let kind = filters.kind.as_deref();
    let collections: Vec<&str> = match &filters.collection {
        Some(collection) => vec![collection.as_str()],
        None => granted,
    };
    let mut items = if kind == Some("team") {
        Vec::new()
    } else {
        record_page(&mut transaction, &window, &collections, &user).await?
    };
    if kind != Some("record") && filters.collection.is_none() {
        items.extend(team_page(&mut transaction, &window, &user).await?);
    }
    transaction.commit().await?;
    Ok(Json(respond(items, filters.limit)))
}

/// Assigned-only staff always read their own actions, whatever the request named.
fn own_actor(user: &UserRow, requested: Option<Uuid>) -> Option<Uuid> {
    if user.has_team_scope() {
        requested
    } else {
        Some(user.id)
    }
}

/// Merges both sources newest first, keeps `limit` items and, when more exist, the
/// cursor of the last item kept.
fn respond(mut items: Vec<Item>, limit: i64) -> Value {
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

    fn item(micros: i64, id: u128) -> Item {
        let actor = Person {
            id: Uuid::nil(),
            name: "Actor".into(),
        };
        let (kind, action, collection) = ("team", "invited".into(), None);
        let (at, record, member, sample) = (String::new(), None, None, false);
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
