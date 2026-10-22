//! Database-backed: run by `npm run test:api` against the disposable database and storage.
use super::*;
use crate::{
    auth::accounts::{create_admin, NewAdmin},
    config::media_settings,
    media::owned,
    records::{
        backfill::{plan::plan, rewrite::rewrite, store::load},
        creation::create,
        validation::validate_new,
    },
    test_database,
    workspaces::{
        self,
        company::{AccountType, NewCompany, Origin},
    },
};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::json;

/// A tiny synthetic JPEG: JFIF header, one scan, end marker.
const JPEG: &[u8] = &[
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x07, b'J', b'F', b'I', b'F', 0, 0xFF, 0xDA, 0x00, 0x02, 0x11,
    0x22, 0xFF, 0xD9,
];

/// A fresh synthetic company with one property holding an inline photo.
async fn inline_property() -> (PgPool, String, Uuid, Uuid) {
    let pool = test_database::pool().await;
    let mut tx = pool.begin().await.unwrap();
    let email = format!("backfill-synthetic-{}@example.test", Uuid::new_v4());
    let admin = NewAdmin {
        name: "Synthetic Backfill Owner",
        email: &email,
        phone: "+971501234567",
        password_hash: "already-hashed-synthetic-fixture",
        language: "en",
        email_verified: false,
    };
    let owner = create_admin(&mut tx, admin).await.unwrap();
    let workspace = owner.to_string();
    let company = NewCompany {
        account_type: AccountType::Brokerage,
        origin: Origin::Operator,
    };
    workspaces::create(&mut tx, &workspace, owner, owner, company)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    let src = format!("data:image/jpeg;base64,{}", STANDARD.encode(JPEG));
    let payload = json!({"listing_title": "Synthetic stale listing",
        "media_photos": [{"name": "Front", "src": src}]});
    let record = validate_new("Properties", payload).unwrap();
    let saved = create(&pool, owner, &workspace, "Properties", record)
        .await
        .unwrap();
    (pool, workspace, owner, saved.id)
}

#[tokio::test]
#[ignore = "needs the disposable test database and storage"]
async fn a_record_saved_meanwhile_is_skipped_and_its_reserved_files_hidden() {
    let (pool, workspace, owner, id) = inline_property().await;
    let config = media_settings::from_env(true)
        .expect("valid storage settings")
        .expect("the test runner sets CRM_MEDIA_*");
    let record = load(&pool, &workspace, id).await.unwrap().unwrap();
    let mut headroom = i64::MAX;
    let plan = plan(&record.fields(), &mut headroom);
    let rewrite = rewrite(&record, &plan).expect("a valid rewrite");
    // A member saves the record after the backfill read it.
    sqlx::query("UPDATE crm_records SET version=version+1 WHERE id=$1")
        .bind(id)
        .execute(&pool)
        .await
        .unwrap();
    let target = Target {
        pool: &pool,
        config: &config,
        workspace: &workspace,
        uploader: owner,
    };
    let outcome = apply(&target, &record, plan, rewrite).await.unwrap();
    assert_eq!(outcome, Outcome::ChangedMeanwhile);
    let (version, src): (i64, String) = sqlx::query_as(
        "SELECT version,payload->'media_photos'->0->>'src' FROM crm_records WHERE id=$1",
    )
    .bind(id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(version, record.version + 1, "only the member's save");
    assert!(src.starts_with("data:image/jpeg;base64,"), "still inline");
    let mut tx = pool.begin().await.unwrap();
    let visible = owned::ids(&mut tx, KIND, id).await.unwrap();
    assert!(visible.is_empty(), "the reserved files are hidden");
}
