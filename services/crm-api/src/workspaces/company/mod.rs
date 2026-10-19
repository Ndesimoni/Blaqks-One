//! Tenancy-owned company metadata; identity remains in auth and seats in team.
mod access;
mod events;
pub mod handlers;
mod model;
mod store;
mod validation;

pub use model::{AccountType, Company, NewCompany, Origin, SeatLimitRequest, SeatUsage};
pub use store::{create, get, seat_limit, set_member_limit};

#[cfg(test)]
mod creation_tests;
#[cfg(test)]
mod invariants_tests;
#[cfg(test)]
mod test_support;
