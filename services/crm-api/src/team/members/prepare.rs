//! Normalises a member update before it is stored (contract §5, §12 L-2, M-D).
use super::{
    directory::MemberRow,
    update::{RecordScopeGrant, UpdateRequest},
};
use crate::team::{catalogue, validation};
use crate::{
    auth::{actions::Actions, permissions::Permissions},
    error::{ApiError, ApiResult},
};

pub const STAFF_ONLY: &str = "Record actions apply to staff only.";
pub const DELETE_NEEDS_TEAM: &str =
    "Deleting clients, contacts or properties needs whole-team visibility.";

pub fn prepare(request: &mut UpdateRequest, current: &MemberRow) -> ApiResult<()> {
    if request.version < 1 {
        return Err(ApiError::invalid("A positive member version is required."));
    }
    let staff = current.user.role == "staff";
    if request.record_scope.is_some() && !staff {
        return Err(ApiError::invalid("Full-team access applies to staff only."));
    }
    if request.actions.is_some() && !staff {
        return Err(ApiError::invalid(STAFF_ONLY));
    }
    request.name = Some(trimmed(request.name.as_deref(), &current.user.name));
    request.phone = Some(trimmed(request.phone.as_deref(), &current.user.phone));
    validation::identity(
        request.name.as_deref().unwrap(),
        &current.user.email,
        request.phone.as_deref().unwrap(),
    )?;
    if !current.accepted && request.active == Some(true) {
        return Err(ApiError::conflict(
            "Activate the invitation before enabling this account.",
        ));
    }
    // Role allowlist (L-4): only Admin and staff rows are editable here.
    match current.user.role.as_str() {
        "admin" => {
            request.positions = Some(vec![]);
            request.permissions = Some(Permissions::full());
        }
        "staff" => prepare_staff(request, current)?,
        _ => return Err(ApiError::forbidden()),
    }
    request.channel_access = Some(
        request
            .channel_access
            .clone()
            .unwrap_or_else(|| current.user.channel_access.0.clone()),
    );
    Ok(())
}

fn trimmed(value: Option<&str>, current: &str) -> String {
    value.unwrap_or(current).trim().into()
}

/// Positions set module defaults; `actions` follow §5 and M-D. Afterwards
/// `request.actions` holds the complete object to store.
fn prepare_staff(request: &mut UpdateRequest, current: &MemberRow) -> ApiResult<()> {
    let selected = request
        .positions
        .clone()
        .unwrap_or_else(|| current.user.positions.0.clone());
    let defaults = catalogue::defaults(&selected)
        .ok_or_else(|| ApiError::invalid("Select valid, distinct team positions."))?;
    let before = current.user.permissions.0.clone();
    let after = request.permissions.clone().unwrap_or_else(|| {
        if request.positions.is_some() {
            defaults
        } else {
            before.clone()
        }
    });
    let team = match request.record_scope {
        Some(scope) => matches!(scope, RecordScopeGrant::Team),
        None => current.user.record_scope == "team",
    };
    let actions = match request.actions {
        Some(actions) if actions.deletes_main() && !team => {
            return Err(ApiError::invalid(DELETE_NEEDS_TEAM));
        }
        Some(actions) => actions.normalised(&after, team),
        None => Actions::from_stored(&current.user.actions.0).carried_over(&before, &after, team),
    };
    request.positions = Some(selected);
    request.permissions = Some(after);
    request.actions = Some(actions);
    Ok(())
}
