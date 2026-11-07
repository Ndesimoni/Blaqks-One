//! §13 M-F7: the single way to open the finance Admin trigger bypass. Finance lock
//! triggers (deals, payments, expenses) allow Admin-path changes only while the
//! transaction-local `kws.finance_admin` setting is on.
use super::access::MANAGE_DENIED;
use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
};
use sqlx::{Postgres, Transaction};

/// Call under the workspace lock with the live row from `access::lock_manager`.
/// Asserts the Admin role (allowlist) and sets the bypass for this transaction only.
pub async fn admin_path(
    transaction: &mut Transaction<'_, Postgres>,
    live: &UserRow,
) -> ApiResult<()> {
    if !live.finance_access().manage || live.role != "admin" {
        return Err(ApiError::denied(MANAGE_DENIED));
    }
    sqlx::query("SELECT set_config('kws.finance_admin', 'on', true)")
        .execute(&mut **transaction)
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::{fs, path::Path};

    fn sources(directory: &Path, found: &mut Vec<String>) {
        for entry in fs::read_dir(directory).unwrap() {
            let path = entry.unwrap().path();
            if path.is_dir() {
                sources(&path, found);
            } else if path.extension().is_some_and(|ext| ext == "rs") {
                found.push(path.to_string_lossy().into_owned());
            }
        }
    }

    #[test]
    fn only_admin_path_sets_the_finance_bypass() {
        let needle = concat!("kws.", "finance_admin");
        let root = Path::new(env!("CARGO_MANIFEST_DIR"));
        let mut files = Vec::new();
        sources(&root.join("src"), &mut files);
        sources(&root.join("tests"), &mut files);
        let users: Vec<_> = files
            .into_iter()
            .filter(|file| fs::read_to_string(file).unwrap().contains(needle))
            .collect();
        assert_eq!(users.len(), 1, "{users:?}");
        assert!(users[0].ends_with("src/finance/admin.rs"), "{users:?}");
    }
}
