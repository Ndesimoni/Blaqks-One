//! The platform event log (docs/blaqks-one-console.md §3a). The module that owns an action
//! calls `record` inside the transaction that makes the change, so the event commits or
//! rolls back with it. Two shapes only: a usage event names the company and the actor's
//! role and never an amount; a money event carries an amount in fils and never the company
//! or the role. No event carries a name, record ID, text, address or message content.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};

/// Where the action happened.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Source {
    Crm,
    CompanySite,
    GeneralSite,
    Marketplace,
    Api,
}

impl Source {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Crm => "crm",
            Self::CompanySite => "company_site",
            Self::GeneralSite => "general_site",
            Self::Marketplace => "marketplace",
            Self::Api => "api",
        }
    }
}

/// One event. Build it with `usage` or `money`; the fields stay private so the two
/// shapes cannot be mixed.
#[derive(Debug, PartialEq, Eq)]
pub struct Event<'a> {
    name: &'a str,
    workspace: Option<&'a str>,
    role: Option<&'a str>,
    source: Source,
    amount_fils: Option<i64>,
}

impl<'a> Event<'a> {
    /// Something a company did: its workspace and the actor's role (never the person).
    pub fn usage(name: &'a str, workspace: &'a str, role: Option<&'a str>, source: Source) -> Self {
        Self {
            name,
            workspace: Some(workspace),
            role,
            source,
            amount_fils: None,
        }
    }

    /// Money that moved somewhere on the platform: the amount only. A negative amount is
    /// stored as zero rather than failing the caller's action.
    pub fn money(name: &'a str, amount_fils: i64, source: Source) -> Self {
        Self {
            name,
            workspace: None,
            role: None,
            source,
            amount_fils: Some(amount_fils.max(0)),
        }
    }
}

/// Appends `event` in the caller's transaction. Money events are stamped with the start of
/// their Asia/Dubai day instead of the exact time, so they cannot be matched to a company's
/// own rows written in the same transaction.
pub async fn record(tx: &mut Transaction<'_, Postgres>, event: Event<'_>) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO platform_metrics.crm_platform_events \
         (occurred_at,event,workspace_id,actor_role,source,amount_fils) \
         VALUES (CASE WHEN $5::bigint IS NULL THEN now() ELSE \
           date_trunc('day',now() AT TIME ZONE 'Asia/Dubai') AT TIME ZONE 'Asia/Dubai' END, \
         $1,$2,$3,$4,$5)",
    )
    .bind(event.name)
    .bind(event.workspace)
    .bind(event.role)
    .bind(event.source.as_str())
    .bind(event.amount_fils)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn usage_events_never_carry_money_and_money_events_never_carry_a_company() {
        let usage = Event::usage("sign_in", "ws-1", Some("admin"), Source::Crm);
        assert_eq!((usage.workspace, usage.amount_fils), (Some("ws-1"), None));
        let money = Event::money("deal_earned", -5, Source::Crm);
        assert_eq!(
            (money.workspace, money.role, money.amount_fils),
            (None, None, Some(0))
        );
        assert_eq!(Source::CompanySite.as_str(), "company_site");
    }
}
