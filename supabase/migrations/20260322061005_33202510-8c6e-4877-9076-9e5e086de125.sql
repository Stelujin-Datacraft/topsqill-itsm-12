INSERT INTO form_submissions (id, form_id, submission_data, submitted_at)
SELECT id::uuid, form_id::uuid, submission_data::jsonb, submitted_at::timestamptz
FROM (VALUES
('edcc30a2-3253-499e-af47-1e485d887885', 'e471c8bf-ed33-47e8-81ee-69847383c90a', '{}', '2024-02-21T09:00:00')
) AS t(id, form_id, submission_data, submitted_at)
WHERE false;