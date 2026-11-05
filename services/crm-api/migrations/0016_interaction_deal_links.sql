-- Interaction log deal links (docs/finance-design.md §6.3, §13 L-F7). Additive; never
-- edit after release. A link resolves only through deal_ref, which names a deal in the
-- same workspace; the payload's deal_id_optional must then carry the same ID.
ALTER TABLE crm_records
    ADD COLUMN deal_ref TEXT,
    ADD CONSTRAINT crm_records_deal_scope CHECK (
        collection = 'Interaction log' OR deal_ref IS NULL
    ),
    ADD CONSTRAINT crm_records_deal_payload CHECK (
        deal_ref IS NULL OR payload ->> 'deal_id_optional' = deal_ref
    ),
    -- Same-workspace composite key, as for payments. Not deferred: deals are never
    -- imported, and deleting a referenced deal is refused (generic 409).
    ADD CONSTRAINT crm_records_deal_link FOREIGN KEY (workspace_id, deal_ref)
        REFERENCES crm_deals(workspace_id, legacy_id);

CREATE INDEX crm_records_deal_links ON crm_records(workspace_id, deal_ref)
    WHERE deal_ref IS NOT NULL;

-- No backfill. Unlike referrals (0007), existing deal_id_optional text is never linked by
-- matching it against deal IDs (L-F7): every existing row keeps deal_ref NULL, and its
-- payload, version and timestamps stay untouched. Such grandfathered values show
-- "Linked deal unavailable" until the next save, which must clear the value or choose
-- a deal the saver can see (409 link_missing otherwise, as for dangling referrals).
-- Read-only report of grandfathered Interaction logs (run by hand, never applied):
--   SELECT workspace_id, legacy_id, payload ->> 'deal_id_optional' AS deal_text
--   FROM crm_records
--   WHERE collection = 'Interaction log' AND deal_ref IS NULL
--     AND jsonb_typeof(payload -> 'deal_id_optional') = 'string'
--     AND btrim(payload ->> 'deal_id_optional') <> ''
--   ORDER BY workspace_id, legacy_id;
