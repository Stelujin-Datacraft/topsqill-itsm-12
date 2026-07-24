-- Advisory locks for cron jobs (multi-instance safe)
CREATE OR REPLACE FUNCTION public.try_cron_advisory_lock(lock_key bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_try_advisory_lock(lock_key);
$$;

CREATE OR REPLACE FUNCTION public.release_cron_advisory_lock(lock_key bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_advisory_unlock(lock_key);
$$;

GRANT EXECUTE ON FUNCTION public.try_cron_advisory_lock(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_cron_advisory_lock(bigint) TO service_role;
