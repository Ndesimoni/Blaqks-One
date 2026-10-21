//! `GET /records/{collection}/{id}/files/{file}`: a record's stored photo or floor plan
//! (packet F2), only for members who may see that record (collection grant and record
//! scope); hidden, foreign and malformed IDs are all not-found.
use super::{lookup, media_links::KIND};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    media::serve,
    state::AppState,
    workspaces,
};
use axum::{
    extract::{Path, State},
    response::Response,
};
use uuid::Uuid;

pub async fn file(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, collection, id, file)): Path<(String, String, String, String)>,
) -> ApiResult<Response> {
    workspaces::ensure_access(&state, &session, &workspace).await?;
    super::validation::collection_key(&collection).map_err(|_| ApiError::missing())?;
    let parse = |value: &str| Uuid::parse_str(value).map_err(|_| ApiError::missing());
    let (id, file) = (parse(&id)?, parse(&file)?);
    let mut tx = state.pool.begin().await?;
    let user = workspaces::member(&mut tx, &workspace, session.user.id).await?;
    if lookup::visible(&mut tx, &workspace, &user, &collection, &[id])
        .await?
        .is_empty()
    {
        return Err(ApiError::missing());
    }
    let response = serve::file(&state, &mut tx, &workspace, KIND, id, file).await?;
    tx.commit().await?;
    Ok(response)
}
