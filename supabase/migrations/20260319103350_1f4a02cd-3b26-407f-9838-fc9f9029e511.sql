
DO $$
DECLARE
  v_form_id uuid;
  v_projects text[] := ARRAY['Alpha Launch', 'Beta Migration', 'Cloud Upgrade', 'Data Pipeline', 'ERP Integration'];
  v_risk_levels text[] := ARRAY['Low', 'Medium', 'High', 'Critical'];
  v_statuses text[] := ARRAY['On Track', 'At Risk', 'Delayed', 'Completed'];
  v_base_date date := '2025-01-06';
  v_report_date date;
  v_revenue int; v_budget_allocated int; v_budget_spent int; v_timeline int;
  v_quality int; v_satisfaction int; v_team_size int; v_risk_idx int; v_status_idx int; v_proj_idx int;
  v_submission_data jsonb; v_submitted_at timestamptz;
  f_project_name uuid; f_report_date uuid; f_revenue uuid; f_budget_spent uuid;
  f_budget_allocated uuid; f_timeline uuid; f_quality uuid; f_satisfaction uuid;
  f_risk uuid; f_status uuid; f_team_size uuid; f_notes uuid;
BEGIN
  INSERT INTO forms (name, description, project_id, organization_id, created_by, status, is_public, layout, pages)
  VALUES (
    'Project KPIs Tracker',
    'Track key project performance indicators including revenue, budget, timeline, quality, and risk metrics.',
    '296c4ff5-673c-4348-84ff-543a5b50b578',
    'dd353598-a070-4f32-85b1-e2c8368da21d',
    '6543b14f-252f-4c8a-8d01-c5f2f4c8ec2c',
    'active', false,
    '{"columns": 2}'::jsonb,
    '[{"id": "default", "name": "Page 1", "order": 0, "fields": []}]'::jsonb
  ) RETURNING id INTO v_form_id;

  INSERT INTO form_fields (form_id, label, field_type, field_order, required, placeholder, options, custom_config) VALUES (v_form_id, 'Project Name', 'text', 0, true, 'Enter project name', null, '{"pageId":"default"}'::jsonb) RETURNING id INTO f_project_name;
  INSERT INTO form_fields (form_id, label, field_type, field_order, required, placeholder, options, custom_config) VALUES (v_form_id, 'Report Date', 'date', 1, true, '', null, '{"pageId":"default"}'::jsonb) RETURNING id INTO f_report_date;
  INSERT INTO form_fields (form_id, label, field_type, field_order, required, placeholder, options, custom_config) VALUES (v_form_id, 'Revenue ($)', 'number', 2, true, 'e.g. 50000', null, '{"pageId":"default"}'::jsonb) RETURNING id INTO f_revenue;
  INSERT INTO form_fields (form_id, label, field_type, field_order, required, placeholder, options, custom_config) VALUES (v_form_id, 'Budget Spent ($)', 'number', 3, true, 'e.g. 30000', null, '{"pageId":"default"}'::jsonb) RETURNING id INTO f_budget_spent;
  INSERT INTO form_fields (form_id, label, field_type, field_order, required, placeholder, options, custom_config) VALUES (v_form_id, 'Budget Allocated ($)', 'number', 4, true, 'e.g. 100000', null, '{"pageId":"default"}'::jsonb) RETURNING id INTO f_budget_allocated;
  INSERT INTO form_fields (form_id, label, field_type, field_order, required, placeholder, options, custom_config) VALUES (v_form_id, 'Timeline Completion (%)', 'number', 5, true, '0-100', null, '{"pageId":"default"}'::jsonb) RETURNING id INTO f_timeline;
  INSERT INTO form_fields (form_id, label, field_type, field_order, required, placeholder, options, custom_config) VALUES (v_form_id, 'Quality Score', 'number', 6, true, '1-10', null, '{"pageId":"default"}'::jsonb) RETURNING id INTO f_quality;
  INSERT INTO form_fields (form_id, label, field_type, field_order, required, placeholder, options, custom_config) VALUES (v_form_id, 'Customer Satisfaction', 'number', 7, false, '1-5', null, '{"pageId":"default"}'::jsonb) RETURNING id INTO f_satisfaction;
  INSERT INTO form_fields (form_id, label, field_type, field_order, required, placeholder, options, custom_config) VALUES (v_form_id, 'Risk Level', 'select', 8, true, '', '[{"id":"opt-low","label":"Low","value":"Low"},{"id":"opt-medium","label":"Medium","value":"Medium"},{"id":"opt-high","label":"High","value":"High"},{"id":"opt-critical","label":"Critical","value":"Critical"}]'::jsonb, '{"pageId":"default"}'::jsonb) RETURNING id INTO f_risk;
  INSERT INTO form_fields (form_id, label, field_type, field_order, required, placeholder, options, custom_config) VALUES (v_form_id, 'Status', 'select', 9, true, '', '[{"id":"opt-on-track","label":"On Track","value":"On Track"},{"id":"opt-at-risk","label":"At Risk","value":"At Risk"},{"id":"opt-delayed","label":"Delayed","value":"Delayed"},{"id":"opt-completed","label":"Completed","value":"Completed"}]'::jsonb, '{"pageId":"default"}'::jsonb) RETURNING id INTO f_status;
  INSERT INTO form_fields (form_id, label, field_type, field_order, required, placeholder, options, custom_config) VALUES (v_form_id, 'Team Size', 'number', 10, false, 'Number of team members', null, '{"pageId":"default"}'::jsonb) RETURNING id INTO f_team_size;
  INSERT INTO form_fields (form_id, label, field_type, field_order, required, placeholder, options, custom_config) VALUES (v_form_id, 'Notes', 'textarea', 11, false, 'Additional comments', null, '{"pageId":"default"}'::jsonb) RETURNING id INTO f_notes;

  FOR i IN 0..19 LOOP
    v_proj_idx := (i % 5) + 1;
    v_report_date := v_base_date + (i * 7);
    v_revenue := 20000 + floor(random() * 80000)::int;
    v_budget_allocated := 50000 + floor(random() * 100000)::int;
    v_budget_spent := floor(v_budget_allocated * (0.2 + random() * 0.7))::int;
    v_timeline := LEAST(100, 10 + floor(i * 4.5 + random() * 5)::int);
    v_quality := 5 + floor(random() * 6)::int;
    v_satisfaction := 2 + floor(random() * 4)::int;
    v_team_size := 5 + floor(random() * 21)::int;
    IF v_revenue < 40000 THEN v_risk_idx := CASE WHEN random() > 0.5 THEN 3 ELSE 4 END;
    ELSE v_risk_idx := CASE WHEN random() > 0.5 THEN 1 ELSE 2 END; END IF;
    IF v_timeline >= 90 THEN v_status_idx := 4;
    ELSIF v_risk_idx >= 3 THEN v_status_idx := 3;
    ELSIF v_risk_idx = 2 THEN v_status_idx := 2;
    ELSE v_status_idx := 1; END IF;

    v_submission_data := jsonb_build_object(
      f_project_name::text, v_projects[v_proj_idx],
      f_report_date::text, v_report_date::text,
      f_revenue::text, v_revenue,
      f_budget_spent::text, v_budget_spent,
      f_budget_allocated::text, v_budget_allocated,
      f_timeline::text, v_timeline,
      f_quality::text, v_quality,
      f_satisfaction::text, v_satisfaction,
      f_risk::text, v_risk_levels[v_risk_idx],
      f_status::text, v_statuses[v_status_idx],
      f_team_size::text, v_team_size,
      f_notes::text, 'Week ' || (i + 1) || ' report for ' || v_projects[v_proj_idx]
    );
    v_submitted_at := v_report_date + ((9 + floor(random() * 8))::int || ' hours')::interval + (floor(random() * 60)::int || ' minutes')::interval;
    INSERT INTO form_submissions (form_id, submission_data, submitted_by, submitted_at)
    VALUES (v_form_id, v_submission_data, '6543b14f-252f-4c8a-8d01-c5f2f4c8ec2c', v_submitted_at);
  END LOOP;
END $$;
