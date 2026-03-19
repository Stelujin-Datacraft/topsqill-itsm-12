-- Make form_id and form_name nullable so projects can be created without a form
ALTER TABLE performance_projects ALTER COLUMN form_id DROP NOT NULL;
ALTER TABLE performance_projects ALTER COLUMN form_name DROP NOT NULL;
ALTER TABLE performance_projects ALTER COLUMN form_id SET DEFAULT NULL;
ALTER TABLE performance_projects ALTER COLUMN form_name SET DEFAULT '';