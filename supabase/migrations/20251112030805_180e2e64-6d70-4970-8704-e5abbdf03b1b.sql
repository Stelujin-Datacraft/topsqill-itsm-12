
-- Clean up duplicate form fields, keeping only the oldest of each type
-- This fixes the issue where every field appears 3 times

WITH ranked_fields AS (
  SELECT 
    id,
    label,
    field_type,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY label, field_type ORDER BY created_at ASC) as rn
  FROM form_fields
  WHERE form_id = '3fb9e916-fd31-4f35-b1e3-b2ce5f5b7edf'
),
fields_to_delete AS (
  SELECT id
  FROM ranked_fields
  WHERE rn > 1  -- Delete duplicates, keep the first (oldest) one
)
DELETE FROM form_fields
WHERE id IN (SELECT id FROM fields_to_delete);

-- Update the form's pages JSON to only include the kept (non-duplicate) field IDs
WITH ranked_fields AS (
  SELECT 
    id,
    label,
    field_type,
    field_order,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY label, field_type ORDER BY created_at ASC) as rn
  FROM form_fields
  WHERE form_id = '3fb9e916-fd31-4f35-b1e3-b2ce5f5b7edf'
),
kept_fields AS (
  SELECT id, field_order
  FROM ranked_fields
  WHERE rn = 1
  ORDER BY field_order
)
UPDATE forms
SET pages = jsonb_build_array(
  jsonb_build_object(
    'id', 'page-1762913215741',
    'name', 'Page 1',
    'order', 0,
    'fields', (
      SELECT jsonb_agg(id ORDER BY field_order)
      FROM kept_fields
    )
  )
)
WHERE id = '3fb9e916-fd31-4f35-b1e3-b2ce5f5b7edf';
