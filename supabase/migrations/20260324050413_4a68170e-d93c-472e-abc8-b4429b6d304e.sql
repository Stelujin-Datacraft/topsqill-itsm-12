
-- Insert the Resource Assignments form
INSERT INTO public.forms (id, name, description, organization_id, project_id, created_by, status, is_public, pages)
VALUES (
  'a1000005-0000-0000-0000-000000000001',
  'Resource Assignments',
  'Stores resource allocation for each task.',
  'dd353598-a070-4f32-85b1-e2c8368da21d',
  '296c4ff5-673c-4348-84ff-543a5b50b578',
  'd4216c3f-d3e4-44dd-97d8-d5ffe84c3435',
  'draft',
  false,
  '[{"id":"default","name":"Page 1","order":0,"fields":["b5000001-0001-0000-0000-000000000001","b5000001-0002-0000-0000-000000000001","b5000001-0003-0000-0000-000000000001","b5000001-0004-0000-0000-000000000001","b5000001-0005-0000-0000-000000000001","b5000001-0006-0000-0000-000000000001","b5000001-0007-0000-0000-000000000001","b5000001-0008-0000-0000-000000000001","b5000001-0009-0000-0000-000000000001","b5000001-0010-0000-0000-000000000001","b5000001-0011-0000-0000-000000000001","b5000001-0012-0000-0000-000000000001"]}]'
);

-- Insert all 12 fields for Resource Assignments
INSERT INTO public.form_fields (id, form_id, label, field_type, placeholder, required, field_order, is_visible, is_enabled, custom_config) VALUES
('b5000001-0001-0000-0000-000000000001', 'a1000005-0000-0000-0000-000000000001', 'Resource_Assignment_ID', 'text', 'Auto-generated ID', true, 0, true, true, null),
('b5000001-0002-0000-0000-000000000001', 'a1000005-0000-0000-0000-000000000001', 'Task_ID', 'cross-reference', 'Select Task', true, 1, true, true, '{"crossReference":{"formId":"a1000004-0000-0000-0000-000000000001","displayFieldId":"b4000001-0003-0000-0000-000000000001","valueFieldId":"b4000001-0001-0000-0000-000000000001"}}'),
('b5000001-0003-0000-0000-000000000001', 'a1000005-0000-0000-0000-000000000001', 'Resource_ID', 'text', 'Enter Resource ID', true, 2, true, true, null),
('b5000001-0004-0000-0000-000000000001', 'a1000005-0000-0000-0000-000000000001', 'Resource_Name', 'text', 'Enter Resource Name', true, 3, true, true, null),
('b5000001-0005-0000-0000-000000000001', 'a1000005-0000-0000-0000-000000000001', 'Role', 'text', 'Enter Role', false, 4, true, true, null),
('b5000001-0006-0000-0000-000000000001', 'a1000005-0000-0000-0000-000000000001', 'Skill_Set', 'text', 'Enter Skill Set', false, 5, true, true, null),
('b5000001-0007-0000-0000-000000000001', 'a1000005-0000-0000-0000-000000000001', 'Allocation (%)', 'number', 'Enter Allocation %', false, 6, true, true, null),
('b5000001-0008-0000-0000-000000000001', 'a1000005-0000-0000-0000-000000000001', 'Planned_Hours', 'number', 'Enter Planned Hours', false, 7, true, true, null),
('b5000001-0009-0000-0000-000000000001', 'a1000005-0000-0000-0000-000000000001', 'Actual_Hours', 'number', 'Enter Actual Hours', false, 8, true, true, null),
('b5000001-0010-0000-0000-000000000001', 'a1000005-0000-0000-0000-000000000001', 'Overtime_Hours', 'number', 'Enter Overtime Hours', false, 9, true, true, null),
('b5000001-0011-0000-0000-000000000001', 'a1000005-0000-0000-0000-000000000001', 'Utilization (%)', 'number', 'Enter Utilization %', false, 10, true, true, null),
('b5000001-0012-0000-0000-000000000001', 'a1000005-0000-0000-0000-000000000001', 'Productivity_Score', 'number', 'Enter Productivity Score', false, 11, true, true, null);
