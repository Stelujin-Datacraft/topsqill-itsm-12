
-- Update the check constraint to allow all the new field types
ALTER TABLE public.form_fields 
DROP CONSTRAINT IF EXISTS form_fields_field_type_check;

-- Add the updated constraint with all field types
ALTER TABLE public.form_fields 
ADD CONSTRAINT form_fields_field_type_check 
CHECK (field_type IN (
  -- Full-width components
  'header', 'description', 'section-break', 'horizontal-line', 'full-width-container',
  'rich-text', 'record-table', 'matrix-grid',
  -- Standard components
  'text', 'textarea', 'number', 'date', 'time', 'datetime',
  'select', 'multi-select', 'radio', 'checkbox', 'toggle-switch',
  'slider', 'rating', 'file', 'image', 'color',
  'country', 'phone', 'address', 'currency', 'email', 'url',
  'ip-address', 'barcode', 'user-picker', 'group-picker',
  'approval', 'signature', 'tags', 'dynamic-dropdown',
  'cross-reference', 'calculated', 'conditional-section',
  'geo-location', 'workflow-trigger'
));
