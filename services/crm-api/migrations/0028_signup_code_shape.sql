-- Owner module: signup; packet R1.
-- A code may be cleared after delivery, supersession, expiry or a terminal failure. Any
-- code that remains must still be six digits and belong to a code job.
ALTER TABLE crm_signup_outbox DROP CONSTRAINT crm_signup_outbox_code_shape;
ALTER TABLE crm_signup_outbox ADD CONSTRAINT crm_signup_outbox_code_shape CHECK (
    code IS NULL OR (kind = 'code' AND code ~ '^[0-9]{6}$'));
