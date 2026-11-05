//! Chooses the workspace by its Admin's account email. The live owner is checked again
//! under the workspace lock (`workspaces::ensure_writable`) before anything is written.
use super::{failed, Outcome};
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

pub const NO_ORGANISATION: &str =
    "Blaqks One's organisation workspace holds no CRM records, so sample data goes to a \
     company Admin's workspace only.";

/// Admins own their company workspace and are the only target. Blaqks One and its
/// organisation hold no CRM (BO1a item 13), so the account and `--organisation` are
/// refused, as are staff, archived and suspended or pending accounts.
pub fn check(account: Option<Account>, organisation: bool) -> Outcome<Target> {
    if organisation {
        return Err(format!("{NO_ORGANISATION}{UNCHANGED}"));
    }
    let account = account.ok_or_else(|| format!("No CRM account uses that email.{UNCHANGED}"))?;
    let refusal = match account.role.as_str() {
        _ if account.archived => Some("That account is archived and its workspace is frozen."),
        "staff" => Some("That is a staff account. Choose the Admin who owns the team."),
        "super-admin" => Some(NO_ORGANISATION),
        _ if !account.active => Some("That Admin is suspended or has not been activated yet."),
        "admin" => None,
        _ => Some("That account cannot own a workspace."),
    };
    if let Some(message) = refusal {
        return Err(format!("{message}{UNCHANGED}"));
    }
    Ok(Target {
        workspace: account.id.to_string(),
        owner: account.id,
        name: account.name,
        email: account.email,
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
    fn admins_own_their_workspace_and_blaqks_one_is_refused() {
        let admin = check(account("admin", true, false), false).unwrap();
        assert_eq!(admin.workspace, admin.owner.to_string());
        for organisation in [false, true] {
            let refused = check(account("super-admin", true, false), organisation).unwrap_err();
            assert!(refused.contains("holds no CRM records") && refused.ends_with(UNCHANGED));
        }
        let flagged = check(account("admin", true, false), true).unwrap_err();
        assert!(flagged.starts_with(NO_ORGANISATION));
    }

    #[test]
    fn refuses_missing_staff_archived_and_suspended_accounts() {
        assert!(check(None, true).is_err());
        for (role, active, archived) in [
            ("staff", true, false),
            ("admin", false, false),
            ("admin", false, true),
            ("super-admin", false, false),
            ("super-admin", true, false),
            ("owner", true, false),
        ] {
            assert!(
                check(account(role, active, archived), false).is_err(),
                "{role}"
            );
        }
    }
}
