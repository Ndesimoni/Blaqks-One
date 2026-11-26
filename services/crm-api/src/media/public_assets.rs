//! Explicit processed copies selected for public publication, independent of outside shares.
use super::copies::{Reserved, Source};
use crate::{
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::response::Response;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const KIND: &str = "public_snapshot";
pub async fn reserve(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
    record: Uuid,
    photos: &[Uuid],
    plans: &[Uuid],
) -> ApiResult<Vec<Reserved>> {
    let ids: Vec<_> = photos.iter().chain(plans).copied().collect();
    let sources = super::copies::sources(tx, workspace, record, &ids).await?;
    if sources.len() != ids.len() {
        return Err(ApiError::invalid(
            "Choose stored files belonging to this property.",
        ));
    }
    let mut selected = Vec::new();
    for (index, id) in ids.iter().enumerate() {
        let source: Source = sources
            .iter()
            .find(|s| s.id == *id)
            .cloned()
            .ok_or_else(ApiError::missing)?;
        let photo = index < photos.len();
        if !source.content_type.starts_with("image/") {
            return Err(ApiError::invalid(
                "Choose processed images for public photos and floor plans. PDF originals stay private.",
            ));
        }
        let extension = match source.content_type.as_str() {
            "image/jpeg" => "jpg",
            "image/png" => "png",
            "image/webp" => "webp",
            _ => return Err(ApiError::invalid("Unsupported public media type.")),
        };
        selected.push((
            source,
            format!(
                "property-{}-{}.{}",
                if photo { "photo" } else { "plan" },
                index + 1,
                extension
            ),
        ));
    }
    super::copies::reserve(tx, workspace, actor, &selected).await
}
pub async fn attach(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
    ids: &[Uuid],
    revision: Uuid,
) -> ApiResult<()> {
    let changed=sqlx::query("UPDATE media.crm_media_objects SET owner_kind=$4,owner_id=$5,attached_at=now() WHERE id=ANY($1) AND workspace_id=$2 AND uploaded_by=$3 AND origin='copy' AND owner_id IS NULL AND NOT storage_pending AND deleted_at IS NULL")
        .bind(ids).bind(workspace).bind(actor).bind(KIND).bind(revision).execute(&mut **tx).await?;
    if changed.rows_affected() != ids.len() as u64 {
        return Err(ApiError::conflict(
            "The selected public media is no longer available.",
        ));
    }
    Ok(())
}
pub async fn available(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    revision: Uuid,
    ids: &[Uuid],
) -> ApiResult<bool> {
    let count:i64=sqlx::query_scalar("SELECT count(*) FROM media.crm_media_objects WHERE id=ANY($1) AND workspace_id=$2 AND owner_kind=$3 AND owner_id=$4 AND origin='copy' AND deleted_at IS NULL AND NOT storage_pending")
        .bind(ids).bind(workspace).bind(KIND).bind(revision).fetch_one(&mut **tx).await?;
    Ok(count == ids.len() as i64)
}
pub async fn serve(
    state: &AppState,
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    revision: Uuid,
    file: Uuid,
) -> ApiResult<Response> {
    super::serve::file(state, tx, workspace, KIND, revision, file).await
}
