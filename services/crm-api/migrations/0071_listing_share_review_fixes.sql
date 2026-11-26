-- Owner module: agreements (docs/record-sharing.md, "R2a security review"). The `accepted`
-- event keeps the last day the agent acknowledged, so the share digest can still be
-- recomputed after the sender extends the share (finding M2). Older acceptances have none.
ALTER TABLE agreements.crm_listing_share_events
    DROP CONSTRAINT crm_listing_share_events_check1;
ALTER TABLE agreements.crm_listing_share_events ADD CONSTRAINT crm_listing_share_events_ends_at
    CHECK (CASE action WHEN 'extended' THEN ends_at IS NOT NULL
        WHEN 'accepted' THEN true ELSE ends_at IS NULL END);
