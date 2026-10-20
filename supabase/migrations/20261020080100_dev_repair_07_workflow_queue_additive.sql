-- =============================================================================
-- DEV REPAIR 07 — Additive workflow_queue column + claim RPC restore
--
-- Preserves any prior Dev-only additive repair for submission_id / trigger_data /
-- started_at and claim_workflow_queue_batch. Uses IF NOT EXISTS / CREATE OR REPLACE
-- only. Does NOT drop/recreate the table. Does NOT add error_message (Nest must
-- write last_error).
--
-- claim_workflow_queue_batch:
--   1) reclaim stuck processing (>5 min): increment retry_count; terminal if maxed
--   2) requeue due retries (failed + next_retry_at <= now + under max)
--   3) claim pending with FOR UPDATE SKIP LOCKED; always set started_at = now()
-- Grant: service_role only (no authenticated EXECUTE — Nest uses service key).
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workflow_queue'
  ) THEN
    RAISE EXCEPTION
      'Dev repair 07 preflight failed — public.workflow_queue missing. Apply base workflow_queue migration first.';
  END IF;
END $$;

ALTER TABLE public.workflow_queue
  ADD COLUMN IF NOT EXISTS submission_id UUID,
  ADD COLUMN IF NOT EXISTS trigger_data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS execution_id UUID,
  ADD COLUMN IF NOT EXISTS trigger_source TEXT DEFAULT 'form_submission',
  ADD COLUMN IF NOT EXISTS trigger_ref TEXT,
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS project_id UUID,
  ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 5;

UPDATE public.workflow_queue
SET
  trigger_data = COALESCE(trigger_data, '{}'::jsonb),
  retry_count = COALESCE(retry_count, 0),
  max_retries = COALESCE(max_retries, 3),
  priority = COALESCE(priority, 5),
  trigger_source = COALESCE(trigger_source, 'form_submission');

-- FK only if no orphans (do not rewrite existing FK ON DELETE semantics)
DO $$
DECLARE
  orphans bigint := 0;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'form_submissions'
  ) THEN
    SELECT COUNT(*) INTO orphans
    FROM public.workflow_queue q
    WHERE q.submission_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.form_submissions s WHERE s.id = q.submission_id);

    IF orphans > 0 THEN
      RAISE EXCEPTION
        'Dev repair 07 blocked: % workflow_queue.submission_id orphans. Fix before adding FK.',
        orphans;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_queue_submission_id_fkey') THEN
      ALTER TABLE public.workflow_queue
        ADD CONSTRAINT workflow_queue_submission_id_fkey
        FOREIGN KEY (submission_id) REFERENCES public.form_submissions(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workflow_queue_pending
  ON public.workflow_queue(status, priority, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_workflow_queue_processing
  ON public.workflow_queue(status, started_at)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_workflow_queue_retry
  ON public.workflow_queue(status, next_retry_at)
  WHERE status = 'failed';

CREATE OR REPLACE FUNCTION public.claim_workflow_queue_batch(batch_size integer DEFAULT 20)
RETURNS SETOF public.workflow_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lim integer := GREATEST(1, LEAST(COALESCE(batch_size, 20), 100));
  stuck_before timestamptz := now() - interval '5 minutes';
BEGIN
  -- Terminal-fail stuck jobs that already exhausted retries
  UPDATE public.workflow_queue
  SET
    status = 'failed',
    completed_at = COALESCE(completed_at, now()),
    started_at = NULL,
    next_retry_at = NULL,
    last_error = COALESCE(
      last_error,
      'Stuck in processing beyond timeout and max retries'
    ),
    retry_count = GREATEST(COALESCE(retry_count, 0), COALESCE(max_retries, 3))
  WHERE status = 'processing'
    AND started_at IS NOT NULL
    AND started_at < stuck_before
    AND COALESCE(retry_count, 0) >= COALESCE(max_retries, 3);

  -- Reclaim stuck processors under retry budget → pending with incremented retry
  UPDATE public.workflow_queue
  SET
    status = 'pending',
    started_at = NULL,
    retry_count = COALESCE(retry_count, 0) + 1,
    last_error = COALESCE(last_error, 'Reset after stuck processing timeout'),
    next_retry_at = NULL
  WHERE status = 'processing'
    AND started_at IS NOT NULL
    AND started_at < stuck_before
    AND COALESCE(retry_count, 0) < COALESCE(max_retries, 3);

  -- Promote due retries back to pending
  UPDATE public.workflow_queue
  SET
    status = 'pending',
    started_at = NULL,
    next_retry_at = NULL
  WHERE status = 'failed'
    AND retry_count < COALESCE(max_retries, 3)
    AND next_retry_at IS NOT NULL
    AND next_retry_at <= now();

  -- Atomic claim: always stamp started_at = now() for accurate stuck detection
  RETURN QUERY
  UPDATE public.workflow_queue q
  SET
    status = 'processing',
    started_at = now()
  FROM (
    SELECT id
    FROM public.workflow_queue
    WHERE status = 'pending'
    ORDER BY priority ASC, created_at ASC
    LIMIT lim
    FOR UPDATE SKIP LOCKED
  ) picked
  WHERE q.id = picked.id
    AND q.status = 'pending'
  RETURNING q.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_workflow_queue_batch(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_workflow_queue_batch(integer) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
