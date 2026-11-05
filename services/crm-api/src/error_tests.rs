use super::*;
use sqlx::error::{DatabaseError, ErrorKind};
use std::{borrow::Cow, error::Error, fmt};

/// A database error with a fixed SQLSTATE and optional constraint name.
#[derive(Debug)]
struct Fake(&'static str, Option<&'static str>);

impl fmt::Display for Fake {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "Assignee is not an active member of this workspace"
        )
    }
}

impl Error for Fake {}

impl DatabaseError for Fake {
    fn message(&self) -> &str {
        "Assignee is not an active member of this workspace"
    }

    fn code(&self) -> Option<Cow<'_, str>> {
        Some(Cow::Borrowed(self.0))
    }

    fn constraint(&self) -> Option<&str> {
        self.1
    }

    fn as_error(&self) -> &(dyn Error + Send + Sync + 'static) {
        self
    }

    fn as_error_mut(&mut self) -> &mut (dyn Error + Send + Sync + 'static) {
        self
    }

    fn into_error(self: Box<Self>) -> Box<dyn Error + Send + Sync + 'static> {
        self
    }

    fn kind(&self) -> ErrorKind {
        ErrorKind::CheckViolation
    }
}

fn mapped(code: &'static str, constraint: Option<&'static str>) -> ApiError {
    ApiError::from(sqlx::Error::Database(Box::new(Fake(code, constraint))))
}

#[test]
fn assignee_trigger_maps_to_a_generic_conflict() {
    let error = mapped("23514", None);
    assert_eq!(error.0, StatusCode::CONFLICT);
    assert_eq!(error.2, "conflict");
    assert_eq!(
        error.1,
        "That team member can no longer receive this record."
    );
}

#[test]
fn named_check_constraints_stay_unavailable() {
    let error = mapped("23514", Some("crm_records_assignable"));
    assert_eq!(error.0, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(error.2, "database_unavailable");
}

#[test]
fn existing_mappings_are_unchanged() {
    assert_eq!(
        mapped("23505", Some("unique")).1,
        "That record ID is already in use."
    );
    assert_eq!(mapped("23503", None).0, StatusCode::CONFLICT);
    assert_eq!(mapped("40001", None).0, StatusCode::SERVICE_UNAVAILABLE);
}

#[test]
fn registered_domain_codes_run_before_the_generic_mapping() {
    crate::routes::register_domain_errors();
    let domain = mapped("P0F05", None);
    assert_eq!((domain.0, domain.2), (StatusCode::FORBIDDEN, "forbidden"));
    assert_eq!(domain.1, domain_code("P0F05").unwrap().1);
    assert_eq!(mapped("23P01", None).0, StatusCode::CONFLICT);
    assert_eq!(mapped("P0001", None).0, StatusCode::SERVICE_UNAVAILABLE);
}
