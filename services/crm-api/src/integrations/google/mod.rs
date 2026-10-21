//! Google Workspace mail adapter (D4, packet E1). E1a: sign-in with state and PKCE,
//! scope and Workspace-domain checks, the proven mailbox address and revocation. Sending
//! (E1b) and reading replies (E1c) use the same token helpers.
pub mod auth_results;
pub mod callback;
pub mod deliver;
pub mod gmail;
pub mod grant;
pub mod history;
mod html;
pub mod message;
pub mod mime;
pub mod oauth;
pub mod parse;
pub mod pkce;
pub mod refresh;
pub mod requests;
