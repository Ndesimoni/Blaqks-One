//! The page window every activity source applies, and the merged item shape
//! (docs/team-activity-design.md). Owners bind the window to fixed placeholders
//! `$1`–`$7`, so each source query stays index-bounded on its workspace and time range.
use serde::Serialize;
use sqlx::{postgres::PgArguments, query::QueryAs, Postgres};
use uuid::Uuid;

/// One page request. `upper` is the exclusive keyset bound `(created_at µs, id)`: the
/// cursor, or the end of the `to` day when no cursor is given.
#[derive(Clone, Debug)]
pub struct Window {
    pub workspace: String,
    pub from_micros: i64,
    pub upper: (i64, Uuid),
    pub actor: Option<Uuid>,
    pub action: Option<String>,
    /// Rows fetched per source: the page limit plus one, to detect a next page.
    pub fetch: i64,
}

impl Window {
    /// The shared WHERE conditions for the table aliased `alias`.
    pub fn clause(alias: &str) -> String {
        format!(
            "{alias}.workspace_id=$1 \
             AND {alias}.created_at >= timestamptz 'epoch' + $2::bigint * interval '1 microsecond' \
             AND ({alias}.created_at,{alias}.id) < \
             (timestamptz 'epoch' + $3::bigint * interval '1 microsecond', $4::uuid) \
             AND ($5::uuid IS NULL OR {alias}.actor_id=$5) \
             AND ($6::text IS NULL OR {alias}.action=$6)"
        )
    }

    /// Selected columns every source returns: keyset micros and the UTC timestamp.
    pub fn stamps(alias: &str) -> String {
        format!(
            "(extract(epoch FROM {alias}.created_at)*1000000)::bigint AS micros, \
             to_char({alias}.created_at AT TIME ZONE 'UTC',\
             'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS at"
        )
    }

    /// Binds `$1`–`$7` (`$7` is the per-source fetch size) in the order of [`clause`].
    pub fn bind<'q, O>(
        &'q self,
        query: QueryAs<'q, Postgres, O, PgArguments>,
    ) -> QueryAs<'q, Postgres, O, PgArguments> {
        query
            .bind(&self.workspace)
            .bind(self.from_micros)
            .bind(self.upper.0)
            .bind(self.upper.1)
            .bind(self.actor)
            .bind(self.action.as_deref())
            .bind(self.fetch)
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct Person {
    pub id: Uuid,
    pub name: String,
}

/// A record handle, present only while the record exists and the caller may see it.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordRef {
    pub id: Uuid,
    pub legacy_id: Option<String>,
}

/// One feed entry. Never carries names of records, values, amounts or reasons.
#[derive(Clone, Debug, Serialize)]
pub struct Item {
    pub id: Uuid,
    pub at: String,
    pub kind: &'static str,
    pub action: String,
    pub collection: Option<String>,
    pub actor: Person,
    pub record: Option<RecordRef>,
    pub member: Option<Person>,
    pub sample: bool,
    #[serde(skip)]
    pub micros: i64,
}

impl Item {
    /// The keyset position, compared newest first.
    pub fn key(&self) -> (i64, Uuid) {
        (self.micros, self.id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_source_binds_the_workspace_range_and_keyset() {
        let sql = Window::clause("a");
        assert!(sql.starts_with("a.workspace_id=$1"));
        assert!(sql.contains("(a.created_at,a.id) <"));
        for placeholder in ["$2", "$3", "$4", "$5", "$6"] {
            assert!(sql.contains(placeholder));
        }
        assert!(!sql.contains("$7"));
        assert!(Window::stamps("t").contains("t.created_at"));
    }
}
