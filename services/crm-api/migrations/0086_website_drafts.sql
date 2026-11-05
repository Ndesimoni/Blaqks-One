-- sites owns private editable drafts, separate from immutable published content versions.
CREATE TABLE sites.crm_website_drafts (
  scope text PRIMARY KEY, version bigint NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  body jsonb NOT NULL, updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
