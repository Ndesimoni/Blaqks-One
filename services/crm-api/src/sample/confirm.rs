//! Shows where the command will write before anything changes, then asks y/N on a
//! terminal. Without a terminal, `--yes` is required.
use super::{
    options::{Command, Options},
    target::{Target, UNCHANGED},
    Outcome,
};
use std::io::{self, IsTerminal, Write};

pub fn summary(options: &Options, database: &str, target: &Target) -> String {
    let action = match (options.command, options.staff) {
        _ if options.platform => platform_action(options),
        (Command::Seed, true) => "add sample records and three sample staff accounts",
        (Command::Seed, false) => "add sample records (no staff accounts)",
        (Command::Clear, _) if options.include_edited => {
            "remove all sample records, including ones changed in the app, and suspend \
             sample staff"
        }
        (Command::Clear, _) => "remove unchanged sample records and suspend sample staff",
    };
    let role = if options.platform {
        "Owner: "
    } else {
        "Admin: "
    };
    format!(
        "Database:  {database}\nWorkspace: {}\n{role}    {} <{}>\nAction:    {action}",
        target.workspace, target.name, target.email
    )
}

/// Blaqks One's own samples (`*-platform-sample`).
fn platform_action(options: &Options) -> &'static str {
    match (options.command, options.staff) {
        (Command::Seed, true) => {
            "add Blaqks One sample clients, help requests and team chat, and four sample \
             team members"
        }
        (Command::Seed, false) => "add Blaqks One sample clients, help requests and team chat",
        (Command::Clear, _) => {
            "archive the sample clients, solve the sample help requests, remove the sample \
             team chat and suspend the sample team members"
        }
    }
}

pub fn confirm(options: &Options, database: &str, target: &Target) -> Outcome<()> {
    eprintln!("{}", summary(options, database, target));
    if options.yes {
        return Ok(());
    }
    if !io::stdin().is_terminal() {
        return Err(format!(
            "Pass --yes to confirm when not running in a terminal.{UNCHANGED}"
        ));
    }
    eprint!("Continue? [y/N] ");
    let _ = io::stderr().flush();
    let mut answer = String::new();
    io::stdin()
        .read_line(&mut answer)
        .map_err(|_| "Could not read the confirmation.")?;
    match answer.trim().to_lowercase().as_str() {
        "y" | "yes" => Ok(()),
        _ => Err(format!("Cancelled.{UNCHANGED}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn summary_names_database_workspace_admin_and_action() {
        let target = Target {
            owner: uuid::Uuid::nil(),
            name: "Aidah".into(),
            email: "aidah@example.test".into(),
            workspace: "ws-1".into(),
        };
        let mut options = Options::parse("clear-sample", &[]).unwrap();
        let text = summary(&options, "127.0.0.1:55432/kws_crm", &target);
        assert!(text.contains("127.0.0.1:55432/kws_crm") && text.contains("ws-1"));
        assert!(text.contains("Aidah <aidah@example.test>") && text.contains("unchanged"));
        options.include_edited = true;
        assert!(summary(&options, "db", &target).contains("including ones changed"));
        let platform = Options::parse("seed-platform-sample", &[]).unwrap();
        let text = summary(&platform, "db", &target);
        assert!(text.contains("Owner:") && text.contains("four sample team members"));
    }
}
