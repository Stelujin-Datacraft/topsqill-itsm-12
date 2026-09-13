TRUNCATE TABLE cron.job_run_details;
TRUNCATE TABLE net._http_response;

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'cleanup-system-execution-logs'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END
$$;

SELECT cron.schedule(
  'cleanup-system-execution-logs',
  '17 3 * * *',
  $cleanup$
    DELETE FROM cron.job_run_details
    WHERE end_time < now() - interval '7 days';
    DELETE FROM net._http_response
    WHERE created < now() - interval '1 day';
  $cleanup$
);