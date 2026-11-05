//! `GET /api/crm/platform/team`: the Owner's Blaqks One team, with the fixed area table
//! (each area's allowed levels) and the levels each position fills, so the page offers
//! exactly what the server accepts.
use super::{rows, target};
use crate::{
    auth::session::Session,
    error::ApiResult,
    state::AppState,
    workspaces::platform::{
        areas::{self, Level},
        presets::{Preset, PRESETS},
    },
};
use axum::{extract::State, Json};
use serde_json::{json, Map, Value};

pub async fn list(State(state): State<AppState>, session: Session) -> ApiResult<Json<Value>> {
    let (mut tx, _) = target::begin(&state, &session, false).await?;
    let members = rows::rows(&mut tx, None).await?;
    tx.commit().await?;
    let mut table = Map::new();
    for area in areas::ALL {
        let levels: Vec<&str> = area
            .levels()
            .iter()
            .map(|level| Level::key(*level))
            .collect();
        table.insert(area.key().into(), json!(levels));
    }
    let mut presets = Map::new();
    for preset in PRESETS
        .into_iter()
        .filter(|preset| *preset != Preset::Custom)
    {
        presets.insert(preset.key().into(), json!(areas::to_map(&preset.access())));
    }
    Ok(Json(
        json!({"members": members, "areas": table, "presets": presets}),
    ))
}
