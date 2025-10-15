-- Add new fields to user_profiles table for user creation
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS nationality TEXT,
ADD COLUMN IF NOT EXISTS mobile TEXT,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS timezone TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.user_profiles.nationality IS 'User nationality/country';
COMMENT ON COLUMN public.user_profiles.mobile IS 'User mobile phone number';
COMMENT ON COLUMN public.user_profiles.gender IS 'User gender';
COMMENT ON COLUMN public.user_profiles.timezone IS 'User timezone preference';