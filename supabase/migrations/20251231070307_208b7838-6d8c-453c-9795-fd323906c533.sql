-- Create a function to bulk update a JSONB field across all submissions for a form
CREATE OR REPLACE FUNCTION public.bulk_update_submission_field(
  _form_id uuid,
  _field_id text,
  _new_value jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE form_submissions
  SET submission_data = submission_data || jsonb_build_object(_field_id, _new_value)
  WHERE form_id = _form_id;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN updated_count;
END;
$$;