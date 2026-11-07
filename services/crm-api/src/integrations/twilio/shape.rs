//! Shape checks before any Twilio call (design §4 step 1): an Account SID is `AC` and 32
//! lower-case hex digits, an Auth Token is 32 lower-case hex digits, and a WhatsApp sender
//! SID is `XE` and 32. A value of any other shape never reaches Twilio or a URL path.
pub const SID: &str =
    "Enter the Account SID from the Twilio Console: AC followed by 32 letters and digits.";
pub const TOKEN: &str = "Enter the Auth Token from the Twilio Console: 32 letters and digits.";

fn hex32(value: &str) -> bool {
    value.len() == 32
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn prefixed(value: &str, prefix: &str) -> bool {
    value.strip_prefix(prefix).is_some_and(hex32)
}

pub fn account_sid(value: &str) -> Result<&str, &'static str> {
    prefixed(value, "AC").then_some(value).ok_or(SID)
}

pub fn auth_token(value: &str) -> Result<&str, &'static str> {
    hex32(value).then_some(value).ok_or(TOKEN)
}

/// A sender SID worth keeping; anything else is stored as unknown.
pub fn sender_sid(value: &str) -> Option<String> {
    prefixed(value, "XE").then(|| value.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    const HEX: &str = "0123456789abcdef0123456789abcdef";

    #[test]
    fn only_twilio_shaped_values_pass() {
        let sid = format!("AC{HEX}");
        assert_eq!(account_sid(&sid), Ok(sid.as_str()));
        // Built at run time so no key-shaped text sits in the source (secret scanning).
        let api_key = format!("SK{HEX}");
        for refused in [
            "",
            "AC",
            "ac0123456789abcdef0123456789abcdef",
            "AC0123456789ABCDEF0123456789ABCDEF",
            "AC0123456789abcdef0123456789abcde",
            "AC0123456789abcdef0123456789abcdef0",
            api_key.as_str(),
            "AC0123456789abcdef0123456789abcdeg",
            "+971500000001",
        ] {
            assert_eq!(account_sid(refused), Err(SID), "{refused}");
        }
        assert_eq!(auth_token(HEX), Ok(HEX));
        assert_eq!(auth_token(&HEX[1..]), Err(TOKEN));
        assert_eq!(auth_token(&format!(" {}", &HEX[1..])), Err(TOKEN));
        assert_eq!(auth_token(&HEX.to_uppercase()), Err(TOKEN));
        assert_eq!(sender_sid(&format!("XE{HEX}")), Some(format!("XE{HEX}")));
        assert_eq!(sender_sid(&format!("AC{HEX}")), None);
    }
}
