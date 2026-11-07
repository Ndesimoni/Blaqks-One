//! Generic delivery jobs (docs/messaging-design.md §5, packet X2): leases with
//! `FOR UPDATE SKIP LOCKED`, an in-flight attempt committed before every provider call,
//! capped retries and an `unknown` state that is never re-sent automatically. Jobs carry a
//! domain and an object ID only. This module owns `outbox.crm_outbox_*`; domains enqueue
//! through [`enqueue::enqueue`] and send through their [`model::Domain`].
pub mod claim;
pub mod cleanup;
pub mod enqueue;
pub mod model;
pub mod run;
pub mod worker;

#[cfg(test)]
mod db_tests;
#[cfg(test)]
mod lease_tests;
#[cfg(test)]
mod retention_tests;
#[cfg(test)]
mod tests;
