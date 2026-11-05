-- Owner module: imports (docs/service-boundaries.md); BO1a item 10 (docs/blaqks-one-console.md).
-- Imports move to each company's owning Admin. A personal source names the live member of
-- that company who receives its parent records; the preview stores that choice with the
-- plan so the commit checks the same member again under the workspace lock. NULL means
-- the parents go to the company's owning Admin. No foreign key (boundary rule 4): the
-- commit re-reads the member through the published profile view. Never edit after release.
ALTER TABLE crm_import_plans ADD COLUMN member_id UUID;
