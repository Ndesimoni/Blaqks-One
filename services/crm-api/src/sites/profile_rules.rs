//! Who may change which part of a public profile (owner decisions 2026-10-30): only the
//! member gives or withdraws consent and chooses their public WhatsApp and email; an
//! Admin may correct another member's name and specialty, and only the Admin hides or
//! shows a staff member, so staff cannot undo a Hide (WEB-UI2 security review).
use super::model::{ProfileInput, ProfileRow};
use serde_json::Value;

/// `own` is the member editing their own profile; `admin` whether the editor is the Admin.
pub fn allowed(
    input: &ProfileInput,
    previous: Option<&ProfileRow>,
    own: bool,
    admin: bool,
) -> bool {
    if own {
        return admin || previous.is_none_or(|row| row.active == input.active);
    }
    let contact = |key: &str| {
        previous
            .and_then(|row| row.body.get(key))
            .and_then(Value::as_str)
    };
    input.consent == previous.is_some_and(|row| row.consent)
        && input.public_whats_app.as_deref() == contact("publicWhatsApp")
        && input.public_email.as_deref() == contact("publicEmail")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use uuid::Uuid;

    fn input(consent: bool, active: bool, email: Option<&str>) -> ProfileInput {
        ProfileInput {
            version: 1,
            name: "Agent".into(),
            specialty: "Homes".into(),
            public_whats_app: None,
            public_email: email.map(str::to_owned),
            consent,
            active,
        }
    }

    fn row(consent: bool, active: bool, email: Option<&str>) -> ProfileRow {
        ProfileRow {
            id: Uuid::nil(),
            workspace: "w".into(),
            member: Uuid::nil(),
            body: json!({ "publicWhatsApp": null, "publicEmail": email }),
            consent,
            can_publish: true,
            active,
            version: 1,
        }
    }

    #[test]
    fn an_admin_keeps_consent_and_contacts_of_another_member() {
        let saved = row(true, true, Some("me@example.test"));
        let kept = input(true, false, Some("me@example.test"));
        assert!(allowed(&kept, Some(&saved), false, true));
        assert!(!allowed(
            &input(false, true, Some("me@example.test")),
            Some(&saved),
            false,
            true
        ));
        assert!(!allowed(
            &input(true, true, Some("other@example.test")),
            Some(&saved),
            false,
            true
        ));
        assert!(!allowed(&input(true, true, None), None, false, true));
        assert!(allowed(&input(false, true, None), None, false, true));
    }

    #[test]
    fn staff_cannot_undo_a_hide_but_set_everything_else() {
        let hidden = row(true, false, None);
        assert!(!allowed(
            &input(true, true, None),
            Some(&hidden),
            true,
            false
        ));
        assert!(allowed(
            &input(false, false, Some("me@example.test")),
            Some(&hidden),
            true,
            false
        ));
        assert!(allowed(&input(true, true, None), None, true, false));
        assert!(allowed(&input(true, true, None), Some(&hidden), true, true));
    }
}
