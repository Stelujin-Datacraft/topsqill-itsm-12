
-- Add missing foreign key constraint between project_users and user_profiles
ALTER TABLE public.project_users 
ADD CONSTRAINT project_users_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

-- Also add foreign key for assigned_by if it doesn't exist
ALTER TABLE public.project_users 
ADD CONSTRAINT project_users_assigned_by_fkey 
FOREIGN KEY (assigned_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
