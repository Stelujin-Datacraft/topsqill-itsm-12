
-- Add is_default column to dashboards
ALTER TABLE public.dashboards ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;

-- Create a function to ensure only one default dashboard per project
CREATE OR REPLACE FUNCTION public.ensure_single_default_dashboard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.dashboards 
    SET is_default = false 
    WHERE project_id = NEW.project_id 
      AND id != NEW.id 
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS ensure_single_default_dashboard_trigger ON public.dashboards;
CREATE TRIGGER ensure_single_default_dashboard_trigger
  BEFORE INSERT OR UPDATE OF is_default ON public.dashboards
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_default_dashboard();
