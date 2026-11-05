//! Resolves who a finance sample belongs to: the workspace Admin, or a sample staff
//! member of this team who is active now. Staff without the finance module can still
//! have an agreement but cannot hold, receive or incur sample finance.
use super::{
    super::{failed, staff::SPECS, target::Target, Outcome},
    specs::Who,
};
use crate::finance::deals::links;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub struct People {
    pub admin: Uuid,
    /// `(Layla, Karim)`: the active account and whether it holds the finance module.
    staff: [Option<(Uuid, bool)>; 2],
}

impl People {
    pub async fn resolve(tx: &mut Transaction<'_, Postgres>, target: &Target) -> Outcome<Self> {
        let mut staff = [None, None];
        for (slot, spec) in staff.iter_mut().zip(&SPECS) {
            let id: Option<Uuid> = sqlx::query_scalar(
                "SELECT u.id FROM crm_users u JOIN crm_sample_accounts m ON m.user_id=u.id \
                 WHERE u.email=$1 AND u.workspace_id=$2 AND u.owner_id=$3 AND u.role='staff' \
                 AND u.active AND u.deleted_at IS NULL",
            )
            .bind(spec.email(&target.email))
            .bind(&target.workspace)
            .bind(target.owner)
            .fetch_optional(&mut **tx)
            .await
            .map_err(failed)?;
            if let Some(id) = id {
                let finance = links::finance_member(tx, &target.workspace, id, true)
                    .await
                    .map_err(failed)?;
                *slot = Some((id, finance));
            }
        }
        Ok(Self {
            admin: target.owner,
            staff,
        })
    }

    fn slot(&self, who: Who) -> Option<(Uuid, bool)> {
        match who {
            Who::Admin => Some((self.admin, true)),
            Who::Layla => self.staff[0],
            Who::Karim => self.staff[1],
        }
    }

    /// The active account, finance or not (agreements).
    pub fn active(&self, who: Who) -> Option<Uuid> {
        self.slot(who).map(|(id, _)| id)
    }

    /// The account when it may hold deals, receive hand-overs and incur expenses.
    pub fn finance(&self, who: Who) -> Option<Uuid> {
        self.slot(who)
            .filter(|(_, finance)| *finance)
            .map(|(id, _)| id)
    }
}
