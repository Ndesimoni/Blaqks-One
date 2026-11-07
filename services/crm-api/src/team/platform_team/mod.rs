//! The Blaqks One team (BO1b, docs/blaqks-one-console.md §8). The Owner invites people with
//! a role preset and ticked areas, edits their areas, suspends, reactivates and archives
//! them, and signs them out or resets their password, on Settings → Blaqks One team. Only
//! the Owner (role `super-admin`) reaches these routes: platform staff never manage the team
//! or their own areas, whatever they hold, and the Owner's own account is never a target.
//! Each person is a `platform` account in the organisation with one `crm_platform_access`
//! row (team owns both); the invitation and activation are the team's existing flow. Team
//! events go to the organisation's team feed with the action only.
pub mod active;
pub mod archive;
pub mod credentials;
pub mod edit;
pub mod invite;
pub mod list;
pub mod renew;
mod rows;
mod target;
