//! Terminal summaries. Generated passwords appear here once and are never stored.
use super::{accounts::Status, clear::Cleared, seed::Seeded, target::Target};
use std::fmt::Write;

fn heading(target: &Target, action: &str) -> String {
    format!(
        "{action} for {} <{}> (workspace {}):\n",
        target.name, target.email, target.workspace
    )
}

pub fn seeded(target: &Target, seeded: &Seeded) -> String {
    let mut text = heading(target, "Sample data");
    let (mut added, mut present) = (0, 0);
    for (collection, new, existing) in &seeded.counts {
        let _ = writeln!(
            text,
            "  {collection:<16} {new:>3} added, {existing:>3} already present"
        );
        (added, present) = (added + new, present + existing);
    }
    let _ = writeln!(
        text,
        "  {:<16} {added:>3} added, {present:>3} already present",
        "Total"
    );
    if seeded.members.is_empty() {
        text.push_str("No sample staff were requested.\n");
        return text;
    }
    text.push_str("Sample staff:\n");
    if seeded.generated.iter().any(Option::is_some) {
        text.push_str(
            "  Warning: generated passwords are shown only once. Do not pipe or save this \
             output into logs or shared files.\n",
        );
    }
    for (member, generated) in seeded.members.iter().zip(&seeded.generated) {
        let access = match (member.status, generated) {
            (Status::Created | Status::Reactivated, Some(password)) => {
                format!("password: {password}")
            }
            (Status::Created | Status::Reactivated, None) => "password: the one you entered".into(),
            (Status::Existing, _) => "already active; password unchanged".into(),
            (Status::Archived, _) => "archived; skipped, its records stay with the Admin".into(),
            (Status::Suspended, _) => {
                "suspended by an Admin in the app; left suspended, its records stay with \
                 the Admin (reactivate it on the Team page)"
                    .into()
            }
        };
        let status = format!("{:?}", member.status).to_lowercase();
        let _ = writeln!(
            text,
            "  {} <{}> {status}; {access}\n      {}",
            member.spec.name(),
            member.email,
            member.spec.summary
        );
    }
    text
}

pub fn cleared(target: &Target, cleared: &Cleared) -> String {
    let mut text = heading(target, "Sample data cleared");
    for (collection, removed) in &cleared.counts {
        let _ = writeln!(text, "  {collection:<16} {removed:>3} removed");
    }
    let total: i64 = cleared.counts.iter().map(|(_, removed)| removed).sum();
    let _ = writeln!(text, "  {:<16} {total:>3} removed", "Total");
    let _ = writeln!(
        text,
        "Sample staff suspended: {} (accounts are archive-only; seeding again \
         reactivates them with new passwords).",
        cleared.suspended
    );
    text
}
