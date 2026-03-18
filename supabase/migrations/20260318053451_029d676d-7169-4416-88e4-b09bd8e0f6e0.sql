
-- Add is_default_report column to reports table
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS is_default_report boolean DEFAULT false;

-- Create trigger to ensure only one default report per dashboard
CREATE OR REPLACE FUNCTION public.ensure_single_default_report()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_default_report = true AND NEW.dashboard_id IS NOT NULL THEN
    UPDATE public.reports 
    SET is_default_report = false 
    WHERE dashboard_id = NEW.dashboard_id 
      AND id != NEW.id 
      AND is_default_report = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_single_default_report_trigger ON public.reports;
CREATE TRIGGER ensure_single_default_report_trigger
  BEFORE INSERT OR UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_default_report();
