//! `GET …/marketplace/board` (packet MK2): open, unexpired requests whose poster is visible and
//! still holds their client, twenty per page with no totals. The caller's own company is listed
//! too, marked `yourCompany` (owner, 2026-10-24). Filters run on the server; the response never
//! carries the client, the source record, the exact budget or a phone.
use super::{
    board_filters::{filters, Board},
    board_limits, gate, request_view, requests, requests_board, sources, visibility,
};
use crate::{
    auth::session::Session, error::ApiResult, records::market_requirements, state::AppState,
};
use axum::{
    extract::{Path, Query, State as AxumState},
    Json,
};
use serde_json::{json, Value};
use std::collections::HashMap;
use uuid::Uuid;

const PAGE: i64 = 20;
const ROUNDS: usize = 5;

pub async fn board(
    AxumState(state): AxumState<AppState>,
    session: Session,
    Path(workspace): Path<String>,
    Query(query): Query<Board>,
) -> ApiResult<Json<Value>> {
    let user = gate::reader(&state, &session, &workspace).await?;
    let filters = filters(&query)?;
    let mut after = match query.cursor.as_deref() {
        Some(text) => Some(board_limits::parsed(text)?),
        None => None,
    };
    let mut tx = state.pool.begin().await?;
    gate::company_open(&mut tx, &workspace).await?;
    gate::joined(&mut tx, session.user.id).await?;
    // Counted after the company and membership checks, so only a joined member spends the budget.
    board_limits::consume(&state, session.user.id, &workspace).await?;
    let listings = crate::records::market_listings::held(&mut tx, &user).await?;
    let facts: Vec<_> = listings
        .iter()
        .map(|(_, payload)| crate::records::outside_facts::read(payload).facts)
        .collect();
    let own = if facts.len() > 1000 {
        None
    } else {
        Some(facts.as_slice())
    };
    let (items, next) = page(&mut tx, &workspace, &filters, &mut after, own).await?;
    tx.commit().await?;
    Ok(Json(json!({ "requests": items, "nextCursor": next })))
}

/// Reads pages until twenty visible requests are found, a page runs out, or the scan is bounded.
async fn page(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    workspace: &str,
    filters: &requests::Filters,
    after: &mut Option<(String, Uuid)>,
    own: Option<&[serde_json::Map<String, Value>]>,
) -> ApiResult<(Vec<Value>, Option<String>)> {
    let mut items: Vec<Value> = Vec::new();
    for _ in 0..ROUNDS {
        let at = after.as_ref().map(|(at, id)| (at.as_str(), *id));
        let rows = requests_board::board_page(tx, filters, at, PAGE).await?;
        let full = rows.len() as i64 == PAGE;
        let Some(last) = rows.last() else {
            return Ok((items, None));
        };
        let following = (last.cursor_at.clone(), last.id);
        let ids: Vec<Uuid> = rows.iter().map(|row| row.id).collect();
        let clients: HashMap<Uuid, Uuid> =
            sources::for_requests(tx, &ids).await?.into_iter().collect();
        let triples: Vec<(String, Uuid, Uuid)> = rows
            .iter()
            .filter_map(|row| {
                clients
                    .get(&row.id)
                    .map(|client| (row.workspace_id.clone(), *client, row.member_id))
            })
            .collect();
        let held = market_requirements::still_held(tx, &triples).await?;
        let mut kept: Option<(String, Uuid)> = None;
        let mut tail = false;
        for (index, row) in rows.iter().enumerate() {
            let Some(client) = clients.get(&row.id) else {
                continue;
            };
            if !held.contains(client) {
                continue;
            }
            // Expired offer capabilities must free capacity before deciding board visibility.
            if super::answer_access::active_count(tx, row.id).await? >= 3 {
                continue;
            }
            let Some(seen) = visibility::visible(tx, row.member_id).await? else {
                continue;
            };
            let broker = json!({
                "memberId": row.member_id,
                "name": seen.name,
                "company": seen.company,
                "hasPhoto": seen.row.photo_id.is_some(),
            });
            let has_matches = own.map(|own| {
                row.workspace_id != workspace
                    && own
                        .iter()
                        .any(|facts| super::matching::checklist(row, facts)["matches"] == true)
            });
            let mut item = request_view::board(row, broker, row.workspace_id == workspace);
            item["hasMatches"] = json!(has_matches);
            items.push(item);
            kept = Some((row.cursor_at.clone(), row.id));
            if items.len() as i64 == PAGE {
                tail = index + 1 < rows.len();
                break;
            }
        }
        if items.len() as i64 == PAGE {
            // The page is complete: continue from the last card while anything is left.
            let next = kept.map(|(at, id)| format!("{at}|{id}"));
            let more = if full || tail { next } else { None };
            return Ok((items, more));
        }
        if !full {
            return Ok((items, None));
        }
        *after = Some(following);
    }
    Ok((items, after.as_ref().map(|(at, id)| format!("{at}|{id}"))))
}
