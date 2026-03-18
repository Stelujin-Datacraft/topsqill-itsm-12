
CREATE OR REPLACE FUNCTION public.clear_default_reports_on_dashboard_undefault()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.is_default = true AND (NEW.is_default = false OR NEW.is_default IS NULL) THEN
    UPDATE public.reports
    SET is_default_report = false
    WHERE dashboard_id = NEW.id
      AND is_default_report = true;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER clear_default_reports_on_dashboard_undefault_trigger
  BEFORE UPDATE ON public.dashboards
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_default_reports_on_dashboard_undefault();
