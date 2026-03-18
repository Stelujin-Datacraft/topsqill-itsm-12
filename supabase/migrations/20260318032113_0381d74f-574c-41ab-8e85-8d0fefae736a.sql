
-- Add default_for column to dashboards ('all' or 'specific')
ALTER TABLE public.dashboards ADD COLUMN IF NOT EXISTS default_for text DEFAULT 'all';

-- Create table to track which specific users should see the default dashboard
CREATE TABLE IF NOT EXISTS public.default_dashboard_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id uuid NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dashboard_id, user_id)
);

-- Enable RLS
ALTER TABLE public.default_dashboard_users ENABLE ROW LEVEL SECURITY;

-- RLS: Users can read their own assignments, admins can manage all
CREATE POLICY "Users can view their own default dashboard assignments"
  ON public.default_dashboard_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_current_user_admin());

CREATE POLICY "Admins can manage default dashboard assignments"
  ON public.default_dashboard_users
  FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());
