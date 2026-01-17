-- Drop the existing constraint
ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_status_check;

-- Add the updated constraint with 'inactive' as an allowed value
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_status_check 
CHECK (status = ANY (ARRAY['active'::text, 'pending'::text, 'suspended'::text, 'inactive'::text]));