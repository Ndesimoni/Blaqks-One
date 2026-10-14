//! Chooses the workspace by its Admin's account email. The live owner is checked again
//! under the workspace lock (`workspaces::ensure_writable`) before anything is written.
use super::{failed, Outcome};
use crate::workspaces::ORGANISATION;
use sqlx::{FromRow, PgPool};
use std::{
    env,
    io::{self, IsTerminal, Write},
};
use uuid::Uuid;

#[derive(Clone, Debug, FromRow)]
pub struct Account {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub role: String,
    pub active: bool,
    pub archived: bool,
}

/// The workspace owner the command acts as and the workspace it writes.
#[derive(Clone, Debug)]
pub struct Target {
    pub owner: Uuid,
    pub name: String,
    pub email: String,
    pub workspace: String,
}

pub const UNCHANGED: &str = " Nothing was changed.";

/// Admins own their team workspace; the Super Admin's organisation workspace holds the
/// organisation's own records, so it needs `--organisation`. Staff, archived and
/// suspended or pending accounts are refused.
pub fn check(account: Option<Account>, organisation: bool) -> Outcome<Target> {
    let account = account.ok_or_else(|| format!("No CRM account uses that email.{UNCHANGED}"))?;
    let refusal = match account.role.as_str() {
        _ if account.archived => Some("That account is archived and its workspace is frozen."),
        "staff" => Some("That is a staff account. Choose the Admin who owns the team."),
        _ if !account.active => Some("That Admin is suspended or has not been activated yet."),
        "super-admin" if !organisation => Some(
            "That is the Super Admin. The organisation workspace holds the organisation's \
             own records; pass --organisation to use it deliberately.",
        ),
        "admin" | "super-admin" => None,
        _ => Some("That account cannot own a workspace."),
    };
    if let Some(message) = refusal {
        return Err(format!("{message}{UNCHANGED}"));
    }
    let workspace = match account.role.as_str() {
        "super-admin" => ORGANISATION.to_owned(),
        _ => account.id.to_string(),
    };
    Ok(Target {
        owner: account.id,
        name: account.name,
        email: account.email,
        workspace,
    })
}

pub async fn resolve(pool: &PgPool, organisation: bool) -> Outcome<Target> {
    let email = admin_email()?;
    let account = sqlx::query_as::<_, Account>(
        "SELECT id,name,email,role,active,deleted_at IS NOT NULL AS archived \
         FROM crm_users WHERE email=$1",
    )
    .bind(email)
    .fetch_optional(pool)
    .await
    .map_err(failed)?;
    check(account, organisation)
}

/// `CRM_SAMPLE_ADMIN_EMAIL`, or a terminal prompt.
fn admin_email() -> Outcome<String> {
    let value = match env::var("CRM_SAMPLE_ADMIN_EMAIL") {
        Ok(value) => value,
        Err(_) if io::stdin().is_terminal() => {
            eprint!("Admin account email: ");
            let _ = io::stderr().flush();
            let mut line = String::new();
            io::stdin()
                .read_line(&mut line)
                .map_err(|_| "Could not read the Admin email.")?;
            line
        }
        Err(_) => return Err("Set CRM_SAMPLE_ADMIN_EMAIL to the Admin account email.".into()),
    };
    let email = value.trim().to_lowercase();
    if email.is_empty() || !email.contains('@') {
        return Err(format!("Provide the Admin account email.{UNCHANGED}"));
    }
    Ok(email)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn account(role: &str, active: bool, archived: bool) -> Option<Account> {
        Some(Account {
            id: Uuid::new_v4(),
            name: "Fixture".into(),
            email: "fixture@example.test".into(),
            role: role.into(),
            active,
            archived,
        })
    }

    #[test]
    fn admins_own_their_workspace_and_the_organisation_needs_the_flag() {
        let admin = check(account("admin", true, false), false).unwrap();
        assert_eq!(admin.workspace, admin.owner.to_string());
        let organisation = check(account("super-admin", true, false), true).unwrap();
        assert_eq!(organisation.workspace, ORGANISATION);
        let refused = check(account("super-admin", true, false), false).unwrap_err();
        assert!(refused.contains("--organisation") && refused.ends_with(UNCHANGED));
    }

    #[test]
    fn refuses_missing_staff_archived_and_suspended_accounts() {
        assert!(check(None, true).is_err());
        for (role, active, archived) in [
            ("staff", true, false),
            ("admin", false, false),
            ("admin", false, true),
            ("super-admin", false, false),
            ("owner", true, false),
        ] {
            assert!(
                check(account(role, active, archived), true).is_err(),
                "{role}"
            );
        }
    }
}
