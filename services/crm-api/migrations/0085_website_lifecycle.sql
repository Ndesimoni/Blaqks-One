-- publications owns these guards. Cross-domain triggers are decision W1 in
-- docs/service-boundaries.md: revoke public material in the source transaction.
CREATE TABLE publications.crm_website_lifecycle_events (
  id uuid PRIMARY KEY, publication uuid NOT NULL,
  version bigint NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER crm_website_lifecycle_events_immutable BEFORE UPDATE OR DELETE
ON publications.crm_website_lifecycle_events FOR EACH ROW
EXECUTE FUNCTION publications.crm_website_revisions_immutable();

CREATE FUNCTION publications.crm_website_revoke(
  p_workspace text,p_member uuid,p_record uuid,p_reason text,p_company_only boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  WITH revoked AS (
    UPDATE publications.crm_website_listings SET active=false,version=version+1
      WHERE active AND (p_workspace IS NULL OR workspace=p_workspace)
      AND (p_member IS NULL OR member=p_member) AND (p_record IS NULL OR record=p_record)
      AND (NOT p_company_only OR destination='company_only') RETURNING id,version
  ) INSERT INTO publications.crm_website_lifecycle_events(id,publication,version,reason)
    SELECT gen_random_uuid(),id,version,p_reason FROM revoked;
END $$;

CREATE FUNCTION publications.crm_website_identity_revoked() RETURNS trigger
LANGUAGE plpgsql AS $$ DECLARE company text; BEGIN
  IF (NEW.active,NEW.deleted_at,NEW.owner_id,NEW.role,NEW.permissions,NEW.actions,NEW.record_scope)
      IS DISTINCT FROM
     (OLD.active,OLD.deleted_at,OLD.owner_id,OLD.role,OLD.permissions,OLD.actions,OLD.record_scope)
  THEN
    PERFORM publications.crm_website_revoke(NULL,NEW.id,NULL,'identity_changed');
    IF OLD.role='admin' AND (NOT NEW.active OR NEW.deleted_at IS NOT NULL) THEN
      FOR company IN SELECT id FROM crm_workspaces WHERE owner_id=NEW.id LOOP
        PERFORM publications.crm_website_revoke(company,NULL,NULL,'owner_disabled');
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_website_identity_revoked AFTER UPDATE ON crm_users FOR EACH ROW
EXECUTE FUNCTION publications.crm_website_identity_revoked();

CREATE FUNCTION publications.crm_website_record_revoked() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN
  IF TG_OP='DELETE' THEN
    PERFORM publications.crm_website_revoke(OLD.workspace_id,NULL,OLD.id,'source_removed');
    RETURN OLD;
  END IF;
  IF NEW.collection='Properties' AND
    (NEW.assignee_id IS DISTINCT FROM OLD.assignee_id OR
     lower(btrim(coalesce(NEW.payload->>'listing_status',''))) NOT IN
       ('available','under offer') OR
     (NEW.payload->>'emirate',NEW.payload->>'community',NEW.payload->>'building_project',NEW.payload->>'unit_reference',NEW.payload->>'permit_expiry',NEW.payload->>'permit_reference')
       IS DISTINCT FROM
     (OLD.payload->>'emirate',OLD.payload->>'community',OLD.payload->>'building_project',OLD.payload->>'unit_reference',OLD.payload->>'permit_expiry',OLD.payload->>'permit_reference'))
  THEN
    PERFORM publications.crm_website_revoke(NEW.workspace_id,NULL,NEW.id,'source_changed');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_website_record_revoked AFTER UPDATE OR DELETE ON crm_records FOR EACH ROW
EXECUTE FUNCTION publications.crm_website_record_revoked();

CREATE FUNCTION publications.crm_website_site_revoked() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.kind='company' THEN
    IF OLD.licence_verified AND NOT NEW.licence_verified THEN
      PERFORM publications.crm_website_revoke(NEW.workspace,NULL,NULL,'licence_revoked');
    ELSIF (OLD.entitled AND NOT NEW.entitled) OR (OLD.active AND NOT NEW.active) THEN
      PERFORM publications.crm_website_revoke(NEW.workspace,NULL,NULL,'company_site_disabled',true);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_website_site_revoked AFTER UPDATE ON sites.crm_website_sites FOR EACH ROW
EXECUTE FUNCTION publications.crm_website_site_revoked();
