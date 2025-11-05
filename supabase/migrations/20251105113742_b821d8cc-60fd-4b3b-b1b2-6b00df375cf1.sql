-- Fix RLS policies that incorrectly reference auth.users table
-- These policies are causing "permission denied for table users" errors

-- Drop the problematic policies on form_fields that reference auth.users directly
DROP POLICY IF EXISTS "Users can view fields of their forms" ON form_fields;
DROP POLICY IF EXISTS "Users can create fields for their forms" ON form_fields;
DROP POLICY IF EXISTS "Users can update fields of their forms" ON form_fields;
DROP POLICY IF EXISTS "Users can delete fields of their forms" ON form_fields;

-- Recreate these policies using user_profiles instead of auth.users
CREATE POLICY "Users can view fields of their forms"
ON form_fields
FOR SELECT
USING (form_id IN (
  SELECT forms.id
  FROM forms
  WHERE forms.created_by = (
    SELECT user_profiles.email
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
));

CREATE POLICY "Users can create fields for their forms"
ON form_fields
FOR INSERT
WITH CHECK (form_id IN (
  SELECT forms.id
  FROM forms
  WHERE forms.created_by = (
    SELECT user_profiles.email
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
));

CREATE POLICY "Users can update fields of their forms"
ON form_fields
FOR UPDATE
USING (form_id IN (
  SELECT forms.id
  FROM forms
  WHERE forms.created_by = (
    SELECT user_profiles.email
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
));

CREATE POLICY "Users can delete fields of their forms"
ON form_fields
FOR DELETE
USING (form_id IN (
  SELECT forms.id
  FROM forms
  WHERE forms.created_by = (
    SELECT user_profiles.email
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
));