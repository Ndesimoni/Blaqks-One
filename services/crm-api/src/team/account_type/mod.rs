//! Seat enforcement and the Super-Admin seat-limit route. Company-type switching is retired
//! (B0, docs/deepseek-delivery-plan.md §3): every company is universal, so no account-type
//! review or switch endpoint is mounted. The stored `account_type` column is kept only for
//! existing rows that predate the universal-company decision.
pub mod limit;
pub(crate) mod seats;
