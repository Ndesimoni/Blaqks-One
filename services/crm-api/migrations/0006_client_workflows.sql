ALTER TABLE crm_records DROP CONSTRAINT crm_records_collection_check;
ALTER TABLE crm_records ADD CONSTRAINT crm_records_collection_check CHECK (collection IN (
    'Clients', 'Contacts', 'Properties', 'Follow-ups', 'Viewings', 'Shortlist',
    'Interaction log', 'Client care'
));

ALTER TABLE crm_activity DROP CONSTRAINT crm_activity_collection_check;
ALTER TABLE crm_activity ADD CONSTRAINT crm_activity_collection_check CHECK (collection IN (
    'Clients', 'Contacts', 'Properties', 'Follow-ups', 'Viewings', 'Shortlist',
    'Interaction log', 'Client care'
));

ALTER TABLE crm_records
    ADD COLUMN client_ref TEXT,
    ADD COLUMN client_collection TEXT NOT NULL DEFAULT 'Clients'
        CHECK (client_collection = 'Clients'),
    ADD COLUMN property_ref TEXT,
    ADD COLUMN property_collection TEXT NOT NULL DEFAULT 'Properties'
        CHECK (property_collection = 'Properties'),
    ADD CONSTRAINT crm_records_client_link FOREIGN KEY (workspace_id, client_collection, client_ref)
        REFERENCES crm_records(workspace_id, collection, legacy_id),
    ADD CONSTRAINT crm_records_property_link
        FOREIGN KEY (workspace_id, property_collection, property_ref)
        REFERENCES crm_records(workspace_id, collection, legacy_id),
    ADD CONSTRAINT crm_records_workflow_links CHECK (
        collection IN ('Follow-ups', 'Viewings', 'Shortlist', 'Interaction log', 'Client care')
        OR (client_ref IS NULL AND property_ref IS NULL)
    );

CREATE INDEX crm_records_client_links ON crm_records(workspace_id, client_ref)
    WHERE client_ref IS NOT NULL;
CREATE INDEX crm_records_property_links ON crm_records(workspace_id, property_ref)
    WHERE property_ref IS NOT NULL;
