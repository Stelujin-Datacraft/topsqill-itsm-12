-- Add password field to user_profiles table
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS password TEXT;