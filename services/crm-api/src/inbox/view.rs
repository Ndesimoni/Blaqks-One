//! The conversation row the staff API returns. `preview` is the latest message's first
//! 140 characters; `unread` compares inbound messages with the viewer's read mark.
use serde_json::{json, Value};
use sqlx::FromRow;
use uuid::Uuid;

/// Columns for alias `c`; `$5` is the viewer's ID for the unread flag.
pub const COLUMNS: &str = "c.id,c.channel,c.state,c.contact_display,c.contact_name, \
    c.match_state,c.linked_collection,c.linked_record_id,c.assignee_id,c.suggested_lead, \
    c.first_source,c.version, \
    to_char(c.last_activity_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') \
      AS last_activity_at, \
    (extract(epoch FROM c.last_activity_at)*1000000)::bigint AS micros, \
    EXISTS (SELECT 1 FROM inbox.crm_inbox_messages m WHERE m.conversation_id=c.id \
      AND m.direction='inbound' AND m.created_at>coalesce((SELECT r.read_at \
      FROM inbox.crm_inbox_reads r WHERE r.conversation_id=c.id AND r.member_id=$5), \
      '-infinity'::timestamptz)) AS unread, \
    (SELECT left(m.body,140) FROM inbox.crm_inbox_messages m WHERE m.conversation_id=c.id \
      ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS preview";

#[derive(Clone, Debug, FromRow)]
pub struct Row {
    pub id: Uuid,
    pub channel: String,
    pub state: String,
    pub contact_display: String,
    pub contact_name: Option<String>,
    pub match_state: String,
    pub linked_collection: Option<String>,
    pub linked_record_id: Option<Uuid>,
    pub assignee_id: Option<Uuid>,
    pub suggested_lead: bool,
    pub first_source: Option<String>,
    pub version: i64,
    pub last_activity_at: String,
    pub micros: i64,
    pub unread: bool,
    pub preview: Option<String>,
}

impl Row {
    pub fn view(&self) -> Value {
        let linked = match (&self.linked_collection, self.linked_record_id) {
            (Some(collection), Some(id)) => json!({"collection": collection, "recordId": id}),
            _ => Value::Null,
        };
        json!({
            "id": self.id,
            "channel": self.channel,
            "state": self.state,
            "contact": {"display": self.contact_display, "name": self.contact_name},
            "match": self.match_state,
            "linked": linked,
            "assigneeId": self.assignee_id,
            "suggestedLead": self.suggested_lead,
            "firstSource": self.first_source,
            "lastActivityAt": self.last_activity_at,
            "unread": self.unread,
            "preview": self.preview,
            "version": self.version,
        })
    }

    pub fn key(&self) -> (i64, Uuid) {
        (self.micros, self.id)
    }
}
