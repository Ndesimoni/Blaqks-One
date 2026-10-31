//! Provider adapter boundary. X1 ships only the local stub, which validates and
//! normalises the fields the real Twilio, Google, Microsoft and Meta adapters will
//! replace behind the same interface (docs/messaging-integrations-plan.md §4 X1.3).
use super::model::Channel;

pub struct ConnectInput<'a> {
    pub label: &'a str,
    pub external_account_id: &'a str,
    pub credential: &'a str,
}

pub struct ConnectedAccount {
    pub label: String,
    pub external_account_id: String,
}

pub trait Provider {
    fn connect(&self, input: &ConnectInput<'_>) -> Result<ConnectedAccount, &'static str>;
    /// Reconnect: confirms a new credential still opens the stored account.
    fn verify(&self, external_account_id: &str, credential: &str) -> Result<(), &'static str>;
}

struct StubProvider;

impl Provider for StubProvider {
    /// Accepts the synthetic account IDs the connected suites use and refuses values
    /// that cannot be a provider account. No network call is made.
    fn connect(&self, input: &ConnectInput<'_>) -> Result<ConnectedAccount, &'static str> {
        self.verify(input.external_account_id, input.credential)?;
        let label = input.label.trim();
        let external = input.external_account_id.trim();
        let account_ok = |value: &str| {
            !value.is_empty()
                && value.chars().all(|character| {
                    character.is_ascii_alphanumeric()
                        || matches!(character, '+' | '-' | '_' | '@' | '.' | ':' | '/')
                })
        };
        let label_ok = !label.is_empty()
            && label
                .chars()
                .all(|character| character.is_alphanumeric() || " -_@.:/&'".contains(character));
        if !account_ok(external) || !label_ok {
            return Err("Use letters, numbers, spaces and + - _ @ . : / & ' only.");
        }
        Ok(ConnectedAccount {
            label: label.to_owned(),
            external_account_id: external.to_owned(),
        })
    }

    /// The stub cannot ask a provider, so it only checks the credential's shape. Real
    /// adapters prove the credential belongs to `external_account_id` (design §8).
    fn verify(&self, _external_account_id: &str, credential: &str) -> Result<(), &'static str> {
        if credential.is_empty() || credential.chars().count() > 4096 {
            return Err("Provide a provider credential.");
        }
        Ok(())
    }
}

static STUB: StubProvider = StubProvider;

pub fn adapter(_channel: Channel) -> &'static dyn Provider {
    &STUB
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input<'a>(label: &'a str, account: &'a str) -> ConnectInput<'a> {
        ConnectInput {
            label,
            external_account_id: account,
            credential: "synthetic-secret",
        }
    }

    #[test]
    fn the_stub_normalises_an_account_and_refuses_unsafe_values() {
        let account = STUB
            .connect(&input(" Studio line ", "+971500000001"))
            .unwrap();
        assert_eq!(account.label, "Studio line");
        assert_eq!(account.external_account_id, "+971500000001");
        assert!(STUB.connect(&input("Line", "bad value")).is_err());
        assert!(STUB.connect(&input("Line", "")).is_err());
    }
}
