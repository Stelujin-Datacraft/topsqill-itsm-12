
CREATE OR REPLACE FUNCTION public.auto_expire_delegations()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.record_delegations
  SET active = false
  WHERE active = true AND ends_at <= now();
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('auto-expire-delegations');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'auto-expire-delegations',
  '*/5 * * * *',
  $$ SELECT public.auto_expire_delegations(); $$
);
