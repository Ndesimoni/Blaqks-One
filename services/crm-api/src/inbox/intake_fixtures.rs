//! Inbox test fixtures: a fresh synthetic company per test, records created through the
//! records module, and verified events built in memory.
use crate::{
    auth::accounts::{create_admin, NewAdmin},
    integrations::webhooks::{
        inbound::Event,
        message::{Inbound, Source},
    },
    records::{creation::create, validation::validate_new},
    test_database,
    workspaces::{
        self,
        company::{AccountType, NewCompany, Origin},
    },
};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

pub struct Company {
    pub pool: PgPool,
    pub workspace: String,
    pub owner: Uuid,
    pub connection: Uuid,
}

pub async fn company() -> Company {
    let pool = test_database::pool().await;
    let mut tx = pool.begin().await.unwrap();
    let email = format!("x3-synthetic-{}@example.test", Uuid::new_v4());
    let owner = create_admin(
        &mut tx,
        NewAdmin {
            name: "Synthetic Inbox Owner",
            email: &email,
            phone: "+971501234567",
            password_hash: "already-hashed-synthetic-fixture",
            language: "en",
            email_verified: false,
        },
    )
    .await
    .unwrap();
    let workspace = owner.to_string();
    let company = NewCompany {
        account_type: AccountType::Brokerage,
        origin: Origin::Operator,
    };
    workspaces::create(&mut tx, &workspace, owner, owner, company)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    Company {
        pool,
        workspace,
        owner,
        connection: Uuid::new_v4(),
    }
}

impl Company {
    /// A record created by the owner through the records module; returns its server ID.
    pub async fn record(&self, collection: &str, payload: Value) -> (Uuid, String) {
        let record = validate_new(collection, payload).unwrap();
        let saved = create(&self.pool, self.owner, &self.workspace, collection, record)
            .await
            .unwrap();
        let key = if collection == "Properties" {
            "property_id"
        } else {
            "client_id"
        };
        let legacy = saved.record[key].as_str().unwrap_or_default().to_owned();
        (saved.id, legacy)
    }

    pub fn event(&self, channel: &str, thread: &str, from: &str, text: &str) -> Event {
        Event {
            receipt_id: Uuid::new_v4(),
            workspace_id: self.workspace.clone(),
            connection_id: self.connection,
            channel: channel.into(),
            message: Inbound {
                thread_id: thread.into(),
                message_id: format!("m-{}", Uuid::new_v4().simple()),
                from: from.into(),
                name: Some("Synthetic Sender".into()),
                text: text.into(),
                has_media: false,
                source: None,
                listing: None,
                email: None,
            },
        }
    }

    pub fn sourced(&self, mut event: Event, source: Source, listing: Option<&str>) -> Event {
        event.message.source = Some(source);
        event.message.listing = listing.map(str::to_owned);
        event
    }

    /// `(match_state, linked_record_id, assignee_id, state, suggested_lead, messages)`.
    pub async fn conversation(&self, thread: &str) -> Conversation {
        sqlx::query_as(
            "SELECT c.match_state,c.linked_record_id,c.assignee_id,c.state,c.suggested_lead, \
               (SELECT count(*) FROM inbox.crm_inbox_messages m WHERE m.conversation_id=c.id) \
             FROM inbox.crm_inbox_conversations c \
             WHERE c.connection_id=$1 AND c.external_thread_id=$2",
        )
        .bind(self.connection)
        .bind(thread)
        .fetch_one(&self.pool)
        .await
        .unwrap()
    }

    pub async fn clients(&self) -> i64 {
        crate::records::lookup::count_for_tests(&self.pool, &self.workspace, "Clients").await
    }
}

pub type Conversation = (String, Option<Uuid>, Option<Uuid>, String, bool, i64);
