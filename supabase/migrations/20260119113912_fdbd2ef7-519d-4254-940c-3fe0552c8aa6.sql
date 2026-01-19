-- Drop the foreign key constraint on changed_by to allow workflow:/datafeed: prefix values
ALTER TABLE public.record_field_history 
DROP CONSTRAINT IF EXISTS record_field_history_changed_by_fkey;

-- Change changed_by column from UUID to TEXT to support workflow:/datafeed: prefixes
ALTER TABLE public.record_field_history 
ALTER COLUMN changed_by TYPE TEXT USING changed_by::TEXT;