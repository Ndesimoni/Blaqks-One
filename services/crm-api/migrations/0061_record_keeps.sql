-- Owner module: records (docs/agreements-design.md §18, packet H3). When a deal hand-over
-- moves the client and the property to the receiver, the sender keeps reading them
-- (`handed_over`); when the listing stays with the sender because other deals use it, the
-- receiver reads it (`shared`). A keep covers that one row, read-only, with the facts its
-- badge shows; the deal reference is display text, not a link into finance.

CREATE TABLE crm_record_keeps (
    workspace_id text NOT NULL REFERENCES crm_workspaces(id),
    record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
    member_id uuid NOT NULL REFERENCES crm_users(id),
    other_id uuid NOT NULL REFERENCES crm_users(id),
    reason text NOT NULL CHECK (reason IN ('handed_over', 'shared')),
    deal_ref text NOT NULL CHECK (char_length(deal_ref) BETWEEN 1 AND 80),
    kind text NOT NULL CHECK (kind IN ('full', 'referral')),
    referral_share_bp integer CHECK (referral_share_bp BETWEEN 1 AND 10000),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (record_id, member_id),
    CHECK (member_id <> other_id),
    CHECK ((kind = 'referral') = (referral_share_bp IS NOT NULL))
);

CREATE INDEX crm_record_keeps_member ON crm_record_keeps (workspace_id, member_id);
