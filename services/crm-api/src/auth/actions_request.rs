//! Request-only decoders for `actions` (action-permissions §5, §14; finance-design §5.1).
use super::actions::Actions;
use serde::Deserialize;

/// Invitations may omit `deleteMain`, finance `approve` and `teamView` (they can only be
/// false there); every other key stays required and unknown keys are still refused.
pub fn invitation(mut value: serde_json::Value) -> Option<Actions> {
    let optional = [
        ("relationships", "deleteMain"),
        ("properties", "deleteMain"),
        ("finance", "approve"),
        ("finance", "teamView"),
    ];
    for (module, key) in optional {
        if let Some(flags) = value
            .get_mut(module)
            .and_then(|flags| flags.as_object_mut())
        {
            flags.entry(key).or_insert(serde_json::Value::Bool(false));
        }
    }
    serde_json::from_value(value).ok()
}

/// A member PATCH's `actions`: strict, but `finance_given` is false when the `finance`
/// key was omitted, so the stored finance flags are carried over (M-D).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(try_from = "serde_json::Value")]
pub struct ActionsRequest {
    pub actions: Actions,
    pub finance_given: bool,
}

impl TryFrom<serde_json::Value> for ActionsRequest {
    type Error = serde_json::Error;

    fn try_from(value: serde_json::Value) -> Result<Self, Self::Error> {
        let finance_given = value.get("finance").is_some();
        let actions = serde_json::from_value(value)?;
        Ok(Self {
            actions,
            finance_given,
        })
    }
}

impl From<Actions> for ActionsRequest {
    /// A complete object, as stored after `prepare`.
    fn from(actions: Actions) -> Self {
        Self {
            actions,
            finance_given: true,
        }
    }
}
