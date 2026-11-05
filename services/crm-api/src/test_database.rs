//! Database-backed Rust tests run only inside the disposable Docker API harness.
use crate::sample::{guard, marker};
use sqlx::PgPool;
use std::env;
use url::Url;

pub(crate) async fn pool() -> PgPool {
    let project = env::var("CRM_TEST_PROJECT").expect("Use the disposable API test harness");
    let suffix = project.strip_prefix("kws-crm-test-").unwrap_or_default();
    assert!(suffix.len() == 12 && suffix.bytes().all(|byte| byte.is_ascii_hexdigit()));
    let database = env::var("CRM_DATABASE_URL").expect("Use the disposable API test harness");
    let insecure = env::var("CRM_ALLOW_INSECURE_LOCAL").as_deref() == Ok("true");
    guard::ensure_local(insecure, &database).expect("Test database must be local");
    let url = Url::parse(&database).expect("Valid test database URL");
    assert_eq!(url.username(), "kws_crm_test");
    assert_eq!(url.path(), "/kws_crm_test");
    assert!(
        url.query().is_none(),
        "Test database URL must have no overrides"
    );
    let pool = PgPool::connect(&database)
        .await
        .expect("Disposable test database");
    let identity: (String, String) = sqlx::query_as("SELECT current_database(),current_user")
        .fetch_one(&pool)
        .await
        .expect("Test database identity");
    assert_eq!(identity, ("kws_crm_test".into(), "kws_crm_test".into()));
    marker::ensure(&pool)
        .await
        .expect("Test database local marker");
    pool
}
