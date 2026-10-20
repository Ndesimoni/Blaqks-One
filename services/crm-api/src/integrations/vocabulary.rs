//! Channel and provider vocabulary for the connections registry, and which provider
//! serves each channel.

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Channel {
    Whatsapp,
    Email,
    Facebook,
    Instagram,
    Tiktok,
}

impl Channel {
    pub fn parse(value: &str) -> Option<Self> {
        Some(match value {
            "whatsapp" => Self::Whatsapp,
            "email" => Self::Email,
            "facebook" => Self::Facebook,
            "instagram" => Self::Instagram,
            "tiktok" => Self::Tiktok,
            _ => return None,
        })
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Whatsapp => "whatsapp",
            Self::Email => "email",
            Self::Facebook => "facebook",
            Self::Instagram => "instagram",
            Self::Tiktok => "tiktok",
        }
    }

    /// Email mailboxes belong to one member; other channels belong to the company.
    pub fn owner_scoped(self) -> bool {
        self == Self::Email
    }

    pub fn allows(self, provider: Provider) -> bool {
        matches!(
            (self, provider),
            (Self::Whatsapp, Provider::Twilio)
                | (Self::Email, Provider::Google | Provider::Microsoft)
                | (Self::Facebook | Self::Instagram, Provider::Meta)
                | (Self::Tiktok, Provider::Tiktok)
        )
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Provider {
    Twilio,
    Google,
    Microsoft,
    Meta,
    Tiktok,
}

impl Provider {
    pub fn parse(value: &str) -> Option<Self> {
        Some(match value {
            "twilio" => Self::Twilio,
            "google" => Self::Google,
            "microsoft" => Self::Microsoft,
            "meta" => Self::Meta,
            "tiktok" => Self::Tiktok,
            _ => return None,
        })
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Twilio => "twilio",
            Self::Google => "google",
            Self::Microsoft => "microsoft",
            Self::Meta => "meta",
            Self::Tiktok => "tiktok",
        }
    }
}
