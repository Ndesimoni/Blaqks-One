//! Payments (commission receipts, finance-design §2.2, §4, §6.2): recorded against a
//! visible earned deal, pending until another approver decides, VAT computed per payment.
pub mod create;
pub mod input;
pub mod row;
pub mod update;
pub mod views;
