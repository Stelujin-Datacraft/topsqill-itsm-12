ALTER TABLE public.data_feeds
  ADD COLUMN IF NOT EXISTS action_on_match TEXT NOT NULL DEFAULT 'update',
  ADD COLUMN IF NOT EXISTS conditional_delete_field_id TEXT,
  ADD COLUMN IF NOT EXISTS conditional_delete_value TEXT;

ALTER TABLE public.data_feeds
  DROP CONSTRAINT IF EXISTS data_feeds_action_on_match_check;

ALTER TABLE public.data_feeds
  ADD CONSTRAINT data_feeds_action_on_match_check
  CHECK (action_on_match IN ('update', 'delete', 'conditional'));

NOTIFY pgrst, 'reload schema';