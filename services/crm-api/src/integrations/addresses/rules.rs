//! What a sending address may look like (docs/sendgrid-design.md §3, §5). The local part
//! is plain lower-case ASCII; the display name can carry no line break, quote, angle
//! bracket or hidden direction character, so it can never add or disguise a header.

pub const LOCAL_PART: &str =
    "Use 1 to 64 lower-case letters, numbers, dots, dashes or underscores, starting and ending with a letter or number.";
pub const ROLE_ADDRESS: &str =
    "This address is kept for the company's mail system. Choose another, such as the person's name.";
pub const DISPLAY_NAME: &str =
    "Use 1 to 80 characters for the name, without @, quotes, angle brackets or line breaks.";

/// Mail-system addresses never belong to one person (RFC 2142); E3c routes them to the
/// company's Unassigned queue.
const ROLES: [&str; 13] = [
    "postmaster",
    "abuse",
    "mailer-daemon",
    "hostmaster",
    "webmaster",
    "noreply",
    "no-reply",
    "security",
    "admin",
    "support",
    "info",
    "dmarc",
    "bounce",
];

pub fn local_part(value: &str) -> Result<String, &'static str> {
    let local = value.trim().to_ascii_lowercase();
    let edge = |byte: Option<&u8>| byte.is_some_and(|byte| byte.is_ascii_alphanumeric());
    let bytes = local.as_bytes();
    let shape = (1..=64).contains(&bytes.len())
        && edge(bytes.first())
        && edge(bytes.last())
        && !local.contains("..")
        && bytes
            .iter()
            .all(|byte| byte.is_ascii_alphanumeric() || b"._-".contains(byte));
    if !shape {
        return Err(LOCAL_PART);
    }
    if ROLES.contains(&local.as_str()) {
        return Err(ROLE_ADDRESS);
    }
    Ok(local)
}

pub fn display_name(value: &str) -> Result<String, &'static str> {
    let name = value.trim();
    let hidden = |character: char| {
        character.is_control()
            || "\"<>\\@".contains(character)
            // Format and separator characters that render as nothing (code review L3).
            || matches!(
                character,
                '\u{00ad}'
                    | '\u{061c}'
                    | '\u{180e}'
                    | '\u{200b}'..='\u{200f}'
                    | '\u{2028}'..='\u{202e}'
                    | '\u{2060}'..='\u{206f}'
                    | '\u{feff}'
                    | '\u{fff9}'..='\u{fffb}'
                    | '\u{e0000}'..='\u{e007f}'
            )
    };
    if name.is_empty() || name.chars().count() > 80 || name.chars().any(hidden) {
        return Err(DISPLAY_NAME);
    }
    Ok(name.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn local_parts_are_plain_lower_case_and_never_role_addresses() {
        assert_eq!(local_part(" Aidah ").unwrap(), "aidah");
        assert_eq!(local_part("simoni.n_2-b").unwrap(), "simoni.n_2-b");
        assert_eq!(local_part(&"a".repeat(64)).unwrap().len(), 64);
        for bad in [
            "",
            ".a",
            "a.",
            "a..b",
            "a b",
            "a+b",
            "a@b",
            "عايدة",
            &"a".repeat(65),
        ] {
            assert_eq!(local_part(bad), Err(LOCAL_PART), "{bad}");
        }
        assert_eq!(local_part("Postmaster"), Err(ROLE_ADDRESS));
        assert_eq!(local_part("no-reply"), Err(ROLE_ADDRESS));
    }

    #[test]
    fn display_names_cannot_carry_header_syntax() {
        assert_eq!(display_name(" Aidah · Keys ").unwrap(), "Aidah · Keys");
        assert!(display_name("عايدة").is_ok());
        for bad in [
            "",
            "a\r\nBcc: x",
            "\"Boss\"",
            "<a@b.c>",
            "x\u{202e}y",
            "ceo@bank.example",
            "a\u{2028}b",
            "soft\u{00ad}hyphen",
            "tag\u{e0041}",
            &"n".repeat(81),
        ] {
            assert_eq!(display_name(bad), Err(DISPLAY_NAME), "{bad}");
        }
    }
}
