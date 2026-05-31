
ALTER TABLE public.workflows ADD COLUMN IF NOT EXISTS notify_on_failure boolean NOT NULL DEFAULT true;
ALTER TABLE public.data_feeds ADD COLUMN IF NOT EXISTS notify_on_failure boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.failure_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('workflow','data_feed')),
  entity_id uuid NOT NULL,
  error_hash text NOT NULL,
  occurrence_count integer NOT NULL DEFAULT 1,
  last_notified_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, error_hash)
);

GRANT SELECT ON public.failure_notifications TO authenticated;
GRANT ALL ON public.failure_notifications TO service_role;

ALTER TABLE public.failure_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view failure notifications"
ON public.failure_notifications FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
);

CREATE INDEX IF NOT EXISTS idx_failure_notifications_entity
  ON public.failure_notifications(entity_type, entity_id, last_notified_at DESC);
