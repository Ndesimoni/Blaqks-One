//! A member's channel identities end with their access (messaging design §3, review M1;
//! WhatsApp design §4, W-M1 and W-L6). Archive and suspension end all of them; losing the
//! email grant ends the mailbox and reserves the SendGrid address; losing the WhatsApp
//! grant disconnects the WhatsApp number. `team` calls this inside its own transaction,
//! with `workspace` the member's own company workspace (locked by `team`), never the
//! workspace of whoever made the change (service boundaries).
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Which of the members' channel identities end.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Leaving {
    pub email: bool,
    pub whatsapp: bool,
}

impl Leaving {
    /// Archive and suspension.
    pub const ALL: Self = Self {
        email: true,
        whatsapp: true,
    };

    pub fn any(self) -> bool {
        self.email || self.whatsapp
    }
}

pub async fn departure(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    members: &[Uuid],
    leaving: Leaving,
    actor: Uuid,
) -> ApiResult<()> {
    if leaving.email {
        let rows = super::store::member_mailboxes(tx, workspace, members).await?;
        for row in &rows {
            super::revocation::disconnect(tx, row, actor).await?;
        }
        super::addresses::write::reserve_members(tx, workspace, members, actor).await?;
    }
    if leaving.whatsapp {
        super::numbers::write::end_members(tx, workspace, members, actor).await?;
    }
    Ok(())
}
