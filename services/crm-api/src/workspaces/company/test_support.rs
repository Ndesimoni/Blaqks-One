use crate::auth::accounts::{self, NewAdmin};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub(super) async fn admin(transaction: &mut Transaction<'_, Postgres>) -> Uuid {
    let email = format!("s2-synthetic-{}@example.test", Uuid::new_v4());
    accounts::create_admin(
        transaction,
        NewAdmin {
            name: "Synthetic Company Owner",
            email: &email,
            phone: "+971501234567",
            password_hash: "already-hashed-synthetic-fixture",
            language: "en",
            email_verified: false,
        },
    )
    .await
    .unwrap()
}
