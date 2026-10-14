-- Same-workspace referral links: Clients.referred_by_client_id and
-- Client care.referred_client_id both point at a Client in the same workspace.
ALTER TABLE crm_records
    ADD COLUMN referral_ref TEXT,
    ADD COLUMN referral_collection TEXT NOT NULL DEFAULT 'Clients'
        CHECK (referral_collection = 'Clients'),
    ADD CONSTRAINT crm_records_referral_scope CHECK (
        collection IN ('Clients', 'Client care') OR referral_ref IS NULL
    );

-- Link existing rows only where the referred client already exists in the same
-- workspace. Payloads, versions and timestamps stay untouched; dangling or
-- self-referring legacy values remain visible but unlinked until edited.
WITH referrals AS (
    SELECT id, workspace_id, collection, legacy_id,
        btrim(payload ->> field, E' \t\r\n') AS referral
    FROM (
        SELECT *, CASE collection
            WHEN 'Clients' THEN 'referred_by_client_id'
            ELSE 'referred_client_id'
        END AS field
        FROM crm_records
        WHERE collection IN ('Clients', 'Client care')
    ) AS candidates
    WHERE jsonb_typeof(payload -> field) = 'string'
)
UPDATE crm_records AS record SET referral_ref = referrals.referral
FROM referrals
WHERE record.id = referrals.id
    AND referrals.referral <> ''
    AND NOT (referrals.collection = 'Clients' AND referrals.referral = referrals.legacy_id)
    AND EXISTS (
        SELECT 1 FROM crm_records AS target
        WHERE target.workspace_id = referrals.workspace_id
            AND target.collection = 'Clients'
            AND target.legacy_id = referrals.referral
    );

-- Deferred to commit so an import may reference a Client later in the same batch.
ALTER TABLE crm_records ADD CONSTRAINT crm_records_referral_link
    FOREIGN KEY (workspace_id, referral_collection, referral_ref)
    REFERENCES crm_records(workspace_id, collection, legacy_id)
    DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX crm_records_referral_links ON crm_records(workspace_id, referral_ref)
    WHERE referral_ref IS NOT NULL;
