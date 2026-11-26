//! What the Blaqks One sample commands print. Generated passwords appear here once and are
//! never stored.
use super::{
    super::{accounts::Status, credentials::Credential, target::Target},
    help::Help,
    team::Member,
};
use std::fmt::Write;

pub struct Seeded {
    /// `(added, already present)`.
    pub clients: (usize, usize),
    pub help: Help,
    pub chat: (usize, usize),
}

pub struct Cleared {
    pub clients: u64,
    pub help: u64,
    pub chat: u64,
    pub team: usize,
}

fn line(text: &mut String, label: &str, (added, present): (usize, usize)) {
    let _ = match present {
        0 => writeln!(text, "  {label:<16} {added:>3} added"),
        _ => writeln!(
            text,
            "  {label:<16} {present:>3} already present; none added"
        ),
    };
}

pub fn seeded(
    target: &Target,
    seeded: &Seeded,
    members: &[Member],
    credentials: &[Credential],
) -> String {
    let mut text = format!(
        "Blaqks One sample data for {} <{}>:\n",
        target.name, target.email
    );
    line(&mut text, "Clients", seeded.clients);
    match seeded.help {
        Help::Added(added) => line(&mut text, "Help requests", (added, 0)),
        Help::Present(present) => line(&mut text, "Help requests", (0, present)),
        Help::NoRequesters => text.push_str(
            "  Help requests      skipped: no company has sample staff to ask. Run \
             npm run crm:sample-data for a company first, then run this again.\n",
        ),
    }
    line(&mut text, "Team chat", seeded.chat);
    if members.is_empty() {
        text.push_str("No sample team members were requested.\n");
        return text;
    }
    text.push_str("Sample team members (sign in as each to see what their position opens):\n");
    if credentials
        .iter()
        .any(|credential| credential.generated.is_some())
    {
        text.push_str(
            "  Warning: generated passwords are shown only once. Do not pipe or save this \
             output into logs or shared files.\n",
        );
    }
    for (member, credential) in members.iter().zip(credentials) {
        let access = match (member.status, &credential.generated) {
            (Status::Created | Status::Reactivated, Some(password)) => {
                format!("password: {password}")
            }
            (Status::Created | Status::Reactivated, None) => "password: the one you entered".into(),
            (Status::Existing, _) => "already active; password unchanged".into(),
            (Status::Archived, _) => "archived in the app; skipped".into(),
            (Status::Suspended, _) => "suspended in the app; left suspended".into(),
        };
        let position = member.spec.preset.label();
        let _ = writeln!(
            text,
            "  {} ({position}) <{}>\n      {access}",
            member.spec.name(),
            member.email
        );
    }
    text
}

pub fn cleared(target: &Target, cleared: &Cleared) -> String {
    format!(
        "Blaqks One sample data cleared for {} <{}>:\n  Clients archived     {:>3}\n  \
         Help requests solved {:>3} (kept as history)\n  Chat messages removed {:>2}\n  \
         Team members suspended {}\n",
        target.name, target.email, cleared.clients, cleared.help, cleared.chat, cleared.team
    )
}
