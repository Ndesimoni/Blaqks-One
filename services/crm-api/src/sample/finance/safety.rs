//! `clear-sample` checks for finance, run under the workspace lock with the record checks
//! (`sample::safety`), returning the same `(collection, ID)` rows for the same messages.

/// Rows people created that depend on sample data: deals on sample clients or properties
/// or earned under a sample agreement, expenses on sample properties, payments on sample
/// deals, and records (Interaction log) linked to sample deals.
pub const LINKED: &str = "WITH sd AS (SELECT d.id,d.legacy_id FROM crm_deals d \
     JOIN crm_sample_finance m ON m.entity='deal' AND m.entity_id=d.id WHERE d.workspace_id=$1), \
     sr AS (SELECT r.collection,r.legacy_id FROM crm_records r \
     JOIN crm_sample_records m ON m.record_id=r.id WHERE r.workspace_id=$1) \
     SELECT 'Deals' AS collection,d.legacy_id FROM crm_deals d WHERE d.workspace_id=$1 \
     AND d.id NOT IN (SELECT id FROM sd) AND (EXISTS (SELECT 1 FROM sr \
     WHERE (sr.collection='Clients' AND sr.legacy_id=d.client_ref) \
     OR (sr.collection='Properties' AND sr.legacy_id=d.property_ref)) \
     OR EXISTS (SELECT 1 FROM crm_deal_snapshots s JOIN crm_sample_finance m \
     ON m.entity='agreement' AND m.entity_id=s.agreement_id WHERE s.deal_id=d.id)) \
     UNION ALL SELECT 'Expenses',e.legacy_id FROM crm_expenses e WHERE e.workspace_id=$1 \
     AND NOT EXISTS (SELECT 1 FROM crm_sample_finance m WHERE m.entity='expense' \
     AND m.entity_id=e.id) AND EXISTS (SELECT 1 FROM sr WHERE sr.collection='Properties' \
     AND sr.legacy_id=e.property_ref) \
     UNION ALL SELECT 'Payments',p.legacy_id FROM crm_payments p WHERE p.workspace_id=$1 \
     AND NOT EXISTS (SELECT 1 FROM crm_sample_finance m WHERE m.entity='payment' \
     AND m.entity_id=p.id) AND p.deal_ref IN (SELECT legacy_id FROM sd) \
     UNION ALL SELECT r.collection,r.legacy_id FROM crm_records r WHERE r.workspace_id=$1 \
     AND r.deal_ref IN (SELECT legacy_id FROM sd) \
     AND NOT EXISTS (SELECT 1 FROM crm_sample_records m WHERE m.record_id=r.id) \
     ORDER BY 1,2";

/// Sample finance changed in the app since seeding: any finance event the sample command
/// did not write (edits, decisions, reassignments, closes), or a hand-over request on a
/// sample deal that the seed did not create. Agreements are listed by agent name.
pub const EDITED: &str = "SELECT CASE m.entity WHEN 'deal' THEN 'Deals' \
     WHEN 'payment' THEN 'Payments' WHEN 'expense' THEN 'Expenses' ELSE 'Agreements' END \
     AS collection,COALESCE(d.legacy_id,p.legacy_id,e.legacy_id,u.name,'') AS legacy_id \
     FROM crm_sample_finance m \
     LEFT JOIN crm_deals d ON m.entity='deal' AND d.id=m.entity_id \
     LEFT JOIN crm_payments p ON m.entity='payment' AND p.id=m.entity_id \
     LEFT JOIN crm_expenses e ON m.entity='expense' AND e.id=m.entity_id \
     LEFT JOIN crm_commission_agreements a ON m.entity='agreement' AND a.id=m.entity_id \
     LEFT JOIN crm_users u ON u.id=a.agent_id \
     WHERE m.workspace_id=$1 AND m.entity IN ('deal','payment','expense','agreement') \
     AND (EXISTS (SELECT 1 FROM crm_finance_events f WHERE f.workspace_id=$1 \
     AND f.entity_id=m.entity_id AND f.source<>'sample') \
     OR (m.entity='deal' AND EXISTS (SELECT 1 FROM crm_deal_handovers h \
     WHERE h.deal_id=m.entity_id AND NOT EXISTS (SELECT 1 FROM crm_sample_finance x \
     WHERE x.entity='handover' AND x.entity_id=h.id)))) \
     ORDER BY 1,2";
