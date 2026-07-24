-- Scalability: hot-path indexes and atomic workflow queue claiming

-- Form submissions: common filter patterns at scale
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_id_submitted_at
  ON public.form_submissions (form_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_form_submissions_form_id_ref_id
  ON public.form_submissions (form_id, submission_ref_id);

-- Workflow executions: waiting/resume scans
CREATE INDEX IF NOT EXISTS idx_workflow_executions_waiting_resume
  ON public.workflow_executions (status, scheduled_resume_at)
  WHERE status = 'waiting';

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_submission
  ON public.workflow_executions (workflow_id, trigger_submission_id, started_at DESC);

-- Workflow instance logs: execution lookups
CREATE INDEX IF NOT EXISTS idx_workflow_instance_logs_execution_status
  ON public.workflow_instance_logs (execution_id, status);

-- Atomic batch claim for workflow queue (multi-instance safe)
CREATE OR REPLACE FUNCTION public.claim_workflow_queue_batch(batch_size integer DEFAULT 20)
RETURNS SETOF public.workflow_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.workflow_queue q
  SET
    status = 'processing',
    started_at = COALESCE(q.started_at, now())
  FROM (
    SELECT id
    FROM public.workflow_queue
    WHERE status = 'pending'
    ORDER BY priority ASC, created_at ASC
    LIMIT GREATEST(1, LEAST(batch_size, 100))
    FOR UPDATE SKIP LOCKED
  ) picked
  WHERE q.id = picked.id
    AND q.status = 'pending'
  RETURNING q.*;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_workflow_queue_batch(integer) TO service_role;

-- Paginated combination keys for duplicate prevention (avoids loading full form)
CREATE OR REPLACE FUNCTION public.get_form_combination_keys(
  p_form_id uuid,
  p_field_ids text[],
  p_limit integer DEFAULT 1000,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(combo_key text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT combo_key
  FROM (
    SELECT (
      SELECT string_agg(ref_id, '|' ORDER BY ref_id)
      FROM (
        SELECT NULLIF(
          COALESCE(
            submission_data ->> field_id,
            submission_data -> field_id ->> 'submission_ref_id',
            submission_data -> field_id ->> 'ref_id'
          ),
          ''
        ) AS ref_id
        FROM unnest(p_field_ids) AS field_id
      ) parts
      WHERE ref_id IS NOT NULL
    ) AS combo_key
    FROM public.form_submissions
    WHERE form_id = p_form_id
    ORDER BY id
    LIMIT GREATEST(1, LEAST(p_limit, 1000))
    OFFSET GREATEST(0, p_offset)
  ) keys
  WHERE combo_key IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_form_combination_keys(uuid, text[], integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_form_combination_keys(uuid, text[], integer, integer) TO authenticated;
